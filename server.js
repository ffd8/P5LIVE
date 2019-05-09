"use strict";
let online = false;
let debugStats = true; // report glitch.com limits

const express = require('express')
, app = express()
, server = require('http').Server(app)
, io = require('socket.io')(server)
, RGA = require('./includes/js/rga.js')
, port = process.env.PORT || 5000
, requestStats = require('request-stats')

const maxSpaces = 200; // check memory for number of namespaces...
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

io.origins((origin, callback) => {
  if (online && origin !== 'https://teddavis.org') {
    return callback('origin not allowed', false);
  }
  callback(null, true);
});

function reportStats(){
	// console.log('ccStats');
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
app.use(express.static('./'));

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
		//console.log("creating: "+name);

		this.name = name;
		this.users = {};
		this.people = {};
		this.namespace = io.of('/' + name);
		this.rga = new RGA(0);
		this.userId = 0;
		this.lockdown = false;
		this.purgeTimer = null;
		this.listenOnNamespace(this.users, this.people, this.name, this.purgeTimer, this.rga);
	}

	listenOnNamespace(users, people, namespace, purgeTimer, rga) {
		this.namespace.on('connection', (socket) => {
			this.userId++;
			this.people[socket.id] = {"nick":this.userId, "status":"focus"};
			io.of(namespace).emit("users", JSON.stringify(people)); // update users for all

			// save namespace if quick return
			if(purgeTimer != null){
				clearTimeout(purgeTimer);
			}

			this.namespace.clients((error, clients) => {
				if (error) throw error;
				users = clients;
			});

			socket.on('disconnect', function() {
				delete people[socket.id];
				io.of(namespace).emit("users", JSON.stringify(people)); // ALL in namespace

				// set timer to trash namespace... 
				if(Object.keys(people).length == 0){
					//console.log('purging: ' + namespace);
					purgeTimer = setTimeout(function(){
						for(let i=0; i<Object.keys(rga); i++){
							Object.keys(rga)[i] = null;
						}
						 //rga = new RGA(0); // need to trash rga.history()
						purgeNamespace(namespace);
					}, (1000 * purgeCounter));
				}
			});

			socket.emit("welcome", {id: this.userId, history: rga.history()})
			socket.emit("cocodeReady");

			if(this.userId == 1){
				socket.emit('init');
			}

			if(this.lockdown){
				if(Object.keys(people).length == 1){
					socket.emit('lockdown', false);
					socket.emit('updateSatus', 'admin');
				}else{
					socket.emit('lockdown', true);
					socket.emit('updateSatus', 'user');
				}
			}

			RGA.tieToSocket(rga, socket);

			socket.on('login', function(newid){
				// check existing name, add random id if so
				let flatUsers = JSON.stringify(people);
				if(flatUsers.indexOf('"'+newid+'"') > -1 ){
					let suffix = Math.floor(Math.random()*99);
					newid += "_"+suffix;
					socket.emit('rename', newid);
				}
				people[socket.id].nick = newid;
				io.of(namespace).emit("users", JSON.stringify(people)); // ALL in namespace
				//socket.broadcast.emit("users", JSON.stringify(people))  // all except sender
			})

			socket.on('lockdown', function(lockMode){
				if(lockMode){
					io.of(namespace).emit('lockdown', true);
				}else{
					io.of(namespace).emit('lockdown', false);
				}
			})

			socket.on('blur', function(){
				people[socket.id].status = "blur";
				io.of(namespace).emit("users", JSON.stringify(people));
			})

			socket.on('focus', function(){
				people[socket.id].status = "focus";
				io.of(namespace).emit("users", JSON.stringify(people));
			})
		});

	}
}
module.exports = Namespace;

const listener = server.listen(port, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
