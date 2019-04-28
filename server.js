"use strict";

const express = require('express')
	, app = express()
	, server = require('http').Server(app)
	, io = require('socket.io')(server)
	, RGA = require('./includes/js/rga.js')
	, port = Number(process.env.PORT) || 5000
	, url = require('url')


let cc = {}; // store namespaces

app.get('/', function (req, res) {
	//res.sendFile(__dirname);
	res.sendFile(__dirname + "/index.html");
	//static_files.serve(req, res);
	var ccRaw = url.parse(req.url, true).query.cc; // get namespaces
	if(ccRaw != null){
		//console.log("REQUEST : " +ccRaw);
		if(cc[ccRaw] === undefined || cc[ccRaw] === null){
			cc[ccRaw] = new Namespace(ccRaw, io);
		}		 
	}
})

// must be after app.get()!
app.use(express.static('./'))


// tip for using socket in class!
// https://stackoverflow.com/q/42998568/10885535
class Namespace {
  constructor(name, io) {
    this.name = name;
    this.users = {};
    this.people = {};
    this.namespace = io.of('/' + name);
    this.rga = new RGA(0);
    this.userId = 0;
    this.lockdown = false;
    this.listenOnNamespace(this.users, this.people, this.name);
  }

  listenOnNamespace(users, people, namespace) {
    this.namespace.on('connection', (socket) => {
		this.userId++;
		this.people[socket.id] = {"nick":this.userId, "status":"focus"};
		io.of(namespace).emit("users", JSON.stringify(people)) // update users for all

		this.namespace.clients((error, clients) => {
		     if (error) throw error;
		     users = clients;
		     //console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
		});
		//console.log(this.people);

		socket.on('disconnect', function() {
			delete people[socket.id];
			io.of(namespace).emit("users", JSON.stringify(people)) // ALL in namespace
			//console.log('removed: '+socket.id)
			//console.log(people);
			//this.clients[socket.id].remove();
	      //console.log('Got disconnect!');

	      //var i = this.clients.indexOf(socket);
	      //this.clients.splice(i, 1);
	   });

		//console.log("joined: " + this.name);
		//socket.join(this.name); // .to(socket.room)
		//console.log("connected: " + this.userId);

		socket.emit("welcome", {id: this.userId, history: this.rga.history()})
		
		if(this.userId == 1){
			socket.emit('init')
		}

		if(this.lockdown){
			if(Object.keys(people).length == 1){
				socket.emit('lockdown', false)
				socket.emit('updateSatus', 'admin')
			}else{
				socket.emit('lockdown', true)
				socket.emit('updateSatus', 'user')
			}
		}

		//socket.downstream = socket.emit.bind(socket, "change")
		// this.rga.subscribe(socket)
		// socket.on('change', op => { this.rga.downstream(op, socket) })

		RGA.tieToSocket(this.rga, socket);

		socket.on('login', function(newid){
			// check existing name
			var flatUsers = JSON.stringify(people);
			if(flatUsers.indexOf('"'+newid+'"') > -1 ){
				var suffix = Math.floor(Math.random()*99);
				// console.log("renaming: "+newid+" to: "+suffix)
				newid += "_"+suffix;
				socket.emit('rename', newid);
			}
			people[socket.id].nick = newid;
			// console.log(people);
			io.of(namespace).emit("users", JSON.stringify(people)) // ALL in namespace
			//socket.broadcast.emit("users", JSON.stringify(people))  // all except sender
			//this.sendUsers();
			//console.log('myname = '+this.name);
			
			//console.log("user " + users[newid].id + " is now known as " + users[newid].nick);
			// console.log(this.userId +" / "+ users);
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
			io.of(namespace).emit("users", JSON.stringify(people))
		})

		socket.on('focus', function(){
			people[socket.id].status = "focus";
			io.of(namespace).emit("users", JSON.stringify(people))
		})


		// socket.on('nick', function(uid, newnick){
		// 	users[uid].nick = newnick;
		// 	console.log("user " + users[uid].id + "is now known as" + users[uid].nick);
		// })

    });

    // this.namespace.on('disconnect', (socket) => {
    // 	users[this.]
    // });
  }
}
module.exports = Namespace;


server.listen(port, function () {
	console.log('listening on *:' + port);
})
