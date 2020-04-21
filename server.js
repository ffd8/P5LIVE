"use strict";
let online = false; // set online
let debugStats = false; // report glitch.com limits

let tPort = process.env.PORT || 5000;
if(process.argv.slice(2).length > 0){
	tPort = process.argv.slice(2)[0];
}

const express = require('express')
, app = express()
, server = require('http').Server(app)
, io = require('socket.io')(server)
, RGA = (online) ? require('./js/rga.js') : require('./includes/js/rga.js') // remove includes for online
, port = tPort
, requestStats = require('request-stats')

// OSC
let iop, osc, oscServer, oscClient, isConnected;
if(!online){
	iop = require('socket.io', {transports: ['WebSocket'] }).listen(8082);
	osc = require('node-osc');
}

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

// OSC
// let oscConnected = 0, oscDisconnected = 0; // debugger... fixed now??
if(!online){
	iop.sockets.on('connection', function (socket) {
		socket.on("config", function (obj) {
			if(isConnected){
				closeOSC();
			}
			// oscConnected++;
			// console.log('OSC - connected - ' + oscConnected);
	    	oscServer = new osc.Server(obj.server.port, obj.server.host);
		    oscClient = new osc.Client(obj.client.host, obj.client.port);
			isConnected = true;
		    // oscClient.send('/status', socket.id + ' connected');
			oscServer.on('message', function(msg, rinfo) {
				socket.emit("message", msg);
			});
			socket.emit("connected", 1);
		});
	 	socket.on("message", function (obj) {
	 		if(isConnected){
				oscClient.send.apply(oscClient, obj);
			}
	  	});
		socket.on('disconnect', function(){
			if (isConnected) {
				closeOSC();
				// oscDisconnected++;
				// console.log('OSC - disconnected - ' + oscDisconnected);
			}
	  	});
	});
}

function closeOSC(){
	oscServer.close();
	oscClient.close();
	oscServer = undefined;
	oscClient = undefined;
	isConnected = false;
}


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
			, "chat" : []
			, "rga": new RGA(0)
			, "userId": 0
			, "lockdown" : false
			, "purgeTimer" : null
			, "sync" : false
			, "fc" : 0
			, "request" : false
			, 'hasAdmin' : false
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
			settings.people[socket.id] = {"nick":socket.handshake.query.nick, "status":"focus", "request":false, "writemode":false, "cursor":{"row":0, "column":0}, "color":"#00aa00", "usesyncdata":false};
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
				clearPendingChat();
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
			socket.emit('syncChat', settings.chat);

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
				syncChat();
				syncSettings();
			})

			socket.on('updateColor', function(newcolor){
				settings.people[socket.id].color = newcolor;
				syncChat();
				syncSettings();
			})

			socket.on('token', function(token){
				// check credentials + allow only one admin
				if(token == settings.token && !settings.hasAdmin){
					settings.people[socket.id].level = 'admin';
					settings.people[socket.id].writemode = true;
					settings.request = false;
					// console.log(settings.people[socket.id].nick);
				}else{
					settings.people[socket.id].level = 'user';
					if(settings.lockdown){
						settings.people[socket.id].writemode = false;
					}
				}
				socket.emit('setLevel', settings.people[socket.id].level);
				syncSettings();

				checkAdmin();
			})

			socket.on('checkAdmin', function(){
				if(!settings.hasAdmin){
					socket.emit('checkAdmin', settings.token);
				}
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

			socket.on('recompile', function(force){
				settings.request = false;
				socket.broadcast.emit('recompile', force); // all except sender
			});

			socket.on('status', function(statusMode){
				settings.people[socket.id].status = statusMode;
				syncUsers();
			});

			socket.on('codeReplaceRequest', function(reqData){
				if(!settings.request){
					Object.keys(settings.people).forEach(function(k){
						if(settings.people[k].level == 'admin'){
							settings.request = true;
							io.of(settings.name).to(`${k}`).emit('codeReplaceRequest', reqData);
						}
					});
				}else{
					socket.emit('codeReplaceBusy');
				}
			})

			socket.on('codeReplaceReject', function(reqData){
				settings.request = false;
				Object.keys(settings.people).forEach(function(k){
					if(settings.people[k].nick == reqData.userID){
						io.of(settings.name).to(`${k}`).emit('codeReplaceReject', reqData);
					}
				});
			})

			socket.on('codeReplace', function(reqData){
				io.of(settings.name).emit('codeReplace', reqData);
			})

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

			socket.on('cursor', function(pos){
				settings.people[socket.id].cursor = pos;
				syncCursors();
			});

			socket.on('syncData', function(obj){
				let syncdataActive = settings.people[socket.id].usesyncdata;
				if((syncdataActive && syncdataActive != obj.usesyncdata) || syncdataActive == undefined){
					settings.people[socket.id].usesyncdata = obj.usesyncdata;
					syncSettings();
				}
				io.of(settings.name).emit('syncData', obj);
			});

			socket.on('chat', function(obj){
				let chatMsg = {
					'nick': settings.people[socket.id].nick,
					'color': settings.people[socket.id].color,
					'id':socket.id,
					'text': obj.text,
					'type':obj.type,
					'msgID':obj.msgID
				}
				if(obj.type == 'send'){
					settings.chat.push(chatMsg);
					addChat(chatMsg);
				}else if(obj.type == 'pending' || obj.type == 'clear'){
					let selMsg = {
						'nick': chatMsg.nick,
						'color': chatMsg.color,
						'text': chatMsg.text,
						'type':chatMsg.type,
						'msgID':chatMsg.msgID
					}
					socket.broadcast.emit('addChat', selMsg);
				}

			});

		});

		let checkAdmin = function(){
			// keep track of an admin in room
			let hasAdmin = false;
			Object.keys(settings.people).forEach(function(k){
				if(settings.people[k].level == 'admin'){
					hasAdmin = true;
				}
			});

			if(hasAdmin){
				settings.hasAdmin = true;
			}else{
				settings.hasAdmin = false;
			}
		}

		let syncUsers = function(){
			checkAdmin();
			io.of(settings.name).emit("syncUsers", JSON.stringify(settings.people)); // update users for all
		}

		let syncSettings = function(){
			checkAdmin();
			let tempSettings = {"lockdown" : settings.lockdown, "sync" : settings.sync, "fc" : settings.fc, "hasAdmin":settings.hasAdmin};
			io.of(settings.name).emit("syncSettings", JSON.stringify(tempSettings)); // update users for all
			syncUsers();
		}

		let syncCursors = function(){
			io.of(settings.name).emit("syncCursors", JSON.stringify(settings.people)); // update users for all
		}

		let clearPendingChat = function(){
			io.of(settings.name).emit("clearPendingChat"); // update users for all
		}

		let addChat = function(obj){
			io.of(settings.name).emit('addChat', obj); // update users for all
		}

		let syncChat = function(){
			let chatMsgs = [];
			for(let c of settings.chat){
				if(settings.people[c.id] != undefined){
					c.nick =  settings.people[c.id].nick;
					c.color =  settings.people[c.id].color;
				}
				let chatMsg = {
					'nick': c.nick,
					'color': c.color,
					'text': c.text,
					'msgID':c.msgID
				}
				chatMsgs.push(chatMsg);
			}
			io.of(settings.name).emit('syncChat', chatMsgs);
		}

	}

}
module.exports = Namespace;

const listener = server.listen(port, function() {
	if(!online){
  		console.log('P5 is LIVE! visit » http://localhost:' + listener.address().port);
	}else{
		console.log('P5 is LIVE! Running on port: ' + listener.address().port);
	}
});
