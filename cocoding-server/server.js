"use strict";
let online = true; // set online
let debugStats = true; // report glitch.com limits

const express = require('express')
, app = express()
, server = require('http').Server(app)
, io = require('socket.io')(server)
, RGA = (online) ? require('./js/rga.js') : require('./includes/js/rga.js') // remove includes for online
, port = process.env.PORT || 5000
, requestStats = require('request-stats')

const maxSpaces = 500; // check memory for number of namespaces...
const purgeCounter = 60; // sec until removing namespace
let cc = {}; // store namespaces
let ccStatsReporting = 15; // sec
let ccStats = {};
ccStats.reqCount = 4000;
let countdown = 1000 * 60 * 60;
ccStats.countdown = "60 min";

/* STATS */
function callEveryHour() {
    setInterval(function(){
    	countdown = 1000 * 60 * 60;
    	ccStats.reqCount = 4000;
    }, 1000 * 60 * 60);
}

function callEveryMinute() {
    setInterval(function(){
    	countdown -= (1000 * ccStatsReporting);
    	ccStats.countdown = Math.floor(countdown/1000/60) + " min";
    	console.log(ccStats);
    }, 1000 * ccStatsReporting); // 60
}

function setupStats(){
	if(debugStats){
		callEveryHour();
		callEveryMinute();
	}
}

setupStats();

function hashCode(s) {
	let h;
	for(let i = 0; i < s.length; i++) 
		h = Math.imul(31, h) + s.charCodeAt(i) | 0;

	return h;
}

app.get('/', function (req, res) {
	if(online){
		res.redirect('https://teddavis.org/p5live');	
	}else{
		res.sendFile(__dirname + "/index.html");

		let ccRaw = req.query.cc; // get namespaces
		if(ccRaw != null && ccRaw.length == 5){
			if(cc[ccRaw] === undefined || cc[ccRaw] === null){
				// create room if under limit
				if(Object.keys(cc).length < maxSpaces){
					cc[ccRaw] = new Namespace(ccRaw, io);
				}else{
					// report rooms are full
					io.of('/' + ccRaw).on('connection', function(socket){
					  socket.emit("full");
					});
				}
			}		 
		}
	}
})

io.set('transports', ['websocket']); 

io.origins((origin, callback) => {
  if (online && origin !== 'https://teddavis.org') {
    return callback('origin not allowed', false);
  }
  callback(null, true);
});


// IT WORKS, dynamic namespaces to class!
const dynamicNsp = io.of(/^\/*/).on('connect', (socket) => {
	if(online){
		ccStats.reqCount--;
		let ccRaw = socket.nsp.name.substring(1);
		if(ccRaw != null && ccRaw.length == 5){
			if(cc[ccRaw] === undefined || cc[ccRaw] === null){
				// create room if under limit
				if(Object.keys(cc).length < maxSpaces){
					cc[ccRaw] = new Namespace(ccRaw, socket.nsp);
				}
			}
		}
	}
});

function reportStats(){
	ccStats.rooms = [];
	for(let i=0; i < Object.keys(cc).length; i++){
		let ccRaw = Object.keys(cc)[i];
		if(cc[ccRaw]!= undefined && Object.keys(cc[ccRaw].people) != undefined){
			let ccCount = Object.keys(cc[ccRaw].people).length;
			if(ccCount > 1){
				ccStats.rooms.push(ccCount);
			}
		}
	}
	ccStats.rooms.sort(function(a, b){return b-a});	
}

requestStats(server, function (stats) {
	// console.log(stats.req.path)
	ccStats.reqCount--;
})

// must be after app.get()!
if(!online){
	app.use(express.static('./'));	
}

// *** remove RGA / data
function purgeNamespace(nsp){
	cc[nsp] = {};
	delete cc[nsp];
	//console.log("removed: " + nsp);
}

// tip for using socket in class!
// https://stackoverflow.com/q/42998568/10885535
class Namespace {
	constructor(name, io) {
		this.settings = {
			"name" : name
			, "token" : hashCode(name)
			, "users" : {}
			, "people" : {}
			, "rga": new RGA(0)
			, "userId": 0
			, "lockdown" : false
			, "purgeTimer" : null
			, "sync" : false
			, "fc" : 0
		}

		if(online){
			this.settings.namespace = io;
		}else{
			this.settings.namespace = io.of('/' + name);
		}

		this.listenOnNamespace(this.settings);
	}

	listenOnNamespace(settings) {
		settings.namespace.on('connection', (socket) => {
			settings.userId++;
			settings.people[socket.id] = {"nick":settings.userId, "status":"focus", "request":false, "writemode":false};
			syncUsers();

			// save namespace if quick return
			if(settings.purgeTimer != null){
				clearTimeout(settings.purgeTimer);
			}

			settings.namespace.clients((error, clients) => {
				if (error) throw error;
				settings.users = clients;
			});

			socket.on('disconnect', function() {
				delete settings.people[socket.id];
				syncUsers(); // ALL in namespace

				// set timer to trash namespace... 
				if(Object.keys(settings.people).length == 0){
					//console.log('purging: ' + namespace);
					settings.purgeTimer = setTimeout(function(){
						for(let i=0; i<Object.keys(settings.rga); i++){
							Object.keys(settings.rga)[i] = null;
						}
						 //rga = new RGA(0); // need to trash rga.history()
						purgeNamespace(settings.namespace);
					}, (1000 * settings.purgeCounter));
				}
			});

			socket.emit("welcome", {id: settings.userId, history: settings.rga.history()})
			socket.emit("cocodeReady");

			if(settings.userId == 1){
				socket.emit('init');
			}


			RGA.tieToSocket(settings.rga, socket);

			socket.on('login', function(newid){
				// check existing name, add random id if so
				let flatUsers = JSON.stringify(settings.people);
				if(flatUsers.indexOf('"'+newid+'"') > -1 ){
					let suffix = Math.floor(Math.random()*99);
					newid += "_"+suffix;
					socket.emit('rename', newid);
				}
				settings.people[socket.id].nick = newid;
				syncSettings();
			})

			socket.on('token', function(token){
				if(token == settings.token){
					settings.people[socket.id].level = 'admin';
					settings.people[socket.id].writemode = true;
				}else{
					settings.people[socket.id].level = 'user';
					if(settings.lockdown){
						settings.people[socket.id].writemode = false;
					}
				}
				socket.emit('setLevel', settings.people[socket.id].level);
				syncSettings();
				//syncUsers();
			})

			socket.on('lockdown', function(lockMode){
				settings.lockdown = lockMode;
				if(!settings.lockdown){
					settings.sync = false;
				}
				syncSettings();
				//syncUsers();
			})

			socket.on('sync', function(syncData){
				settings.sync = syncData.mode;
				settings.fc = syncData.fc;
				syncSettings();
			})

			socket.on('dispatchSyncEvent', function(evData){
				socket.broadcast.emit('dispatchSyncEvent', JSON.stringify(evData)); // all except sender
			});

			socket.on('recompile', function(){
				socket.broadcast.emit('recompile'); // all except sender
			});

			socket.on('status', function(statusMode){
				settings.people[socket.id].status = statusMode;
				syncUsers();
			});

			socket.on('editRequest', function(reqData){
				settings.people[socket.id].request = reqData.mode;
				syncUsers();
			})

			socket.on('rejectRequest', function(reqData){
				Object.keys(settings.people).forEach(function(k){
					if(settings.people[k].nick == reqData.userID){
						settings.people[k].request = false;
						io.of(settings.name).to(`${k}`).emit('requestReject');
					}
				});
				syncUsers();
			})

			socket.on('toggleEdit', function(reqData){
				Object.keys(settings.people).forEach(function(k){
					if(settings.people[k].nick == reqData.userID){
						if(!settings.people[k].writemode){
							settings.people[k].writemode = true;
							io.of(settings.name).to(`${k}`).emit('toggleEdit', true);
						}else{
							settings.people[k].writemode = false;
							io.of(settings.name).to(`${k}`).emit('toggleEdit', false);
						}
						settings.people[k].request = false;
					}
				});
				syncUsers();
			})
		});

		let syncUsers = function(){
			io.of(settings.name).emit("syncUsers", JSON.stringify(settings.people)); // update users for all
		}

		let syncSettings = function(){
			let tempSettings = {"lockdown" : settings.lockdown, "sync" : settings.sync, "fc" : settings.fc};
			io.of(settings.name).emit("syncSettings", JSON.stringify(tempSettings)); // update users for all
			syncUsers();
		}

	}

}
module.exports = Namespace;

const listener = server.listen(port, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
