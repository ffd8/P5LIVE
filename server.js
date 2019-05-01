"use strict";

const express = require('express')
, app = express()
, server = require('http').Server(app)
, io = require('socket.io')(server)
, RGA = require('./includes/js/rga.js')
, port = process.env.PORT || 5000

const maxSpaces = 20; // check memory for number of namespaces...
const purgeCounter = 5; // sec until removing namespace
let cc = {}; // store namespaces


app.get('/', function (req, res) {
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
})

// must be after app.get()!
app.use(express.static('./'));

// *** remove RGA / data
function purgeNamespace(nsp){
	delete cc[nsp];
	cc[nsp] = undefined;
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
