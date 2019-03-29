"use strict";

const express = require('express')
	, app = express()
	, server = require('http').Server(app)
	, io = require('socket.io')(server)
	, RGA = require('./includes/js/rga.js')
	, port = Number(process.env.PORT) || 5000
	, url = require('url')


// app.use(express.static('lib'))
// app.use(express.static('fonts'))
// app.use(express.static('includes'))

let cc = {}; // store rooms

app.get('/', function (req, res) {
	//res.sendFile(__dirname);
	res.sendFile(__dirname + "/index.html");
	//static_files.serve(req, res);
	console.log('hi')
	var ccRaw = url.parse(req.url, true).query.cc; // get room
	if(ccRaw != null){
		console.log("REQUEST : " +ccRaw);
		if(cc[ccRaw] === undefined || cc[ccRaw] === null){
			cc[ccRaw] = new Room(ccRaw, io);
		}		 
	}
})

// must be after app.get()!
app.use(express.static('./'))


// tip for using socket in class!
// https://stackoverflow.com/q/42998568/10885535
class Room {
  constructor(name, io) {
    this.name = name;
    this.users = {};
    this.namespace = io.of('/' + name);
    this.rga = new RGA(0);
    this.userId = 0;
    this.test = [];
    this.listenOnRoom(this.users);
  }

  listenOnRoom(users) {
    this.namespace.on('connection', (socket) => {
		this.userId++;
		this.test.push(this.userId);
		//console.log(this.test);
		console.log("joined: " + this.name);
		//console.log("connected: " + this.userId);

		socket.emit("init", {id: this.userId, history: this.rga.history()})

		socket.downstream = socket.emit.bind(socket, "change")
		this.rga.subscribe(socket)

		socket.on('change', op => { this.rga.downstream(op, socket) })

		socket.on('login', function(newid, newnick){
			// this.userId = newid;
			// console.log("newuser: " + this.userId);
			users[newid] = {"id":newid, "nick":newnick};
			console.log("user " + users[newid].id + " is now known as " + users[newid].nick);
			// console.log(this.userId +" / "+ users);
		})


		// socket.on('nick', function(uid, newnick){
		// 	users[uid].nick = newnick;
		// 	console.log("user " + users[uid].id + "is now known as" + users[uid].nick);
		// })

    });
  }
}
module.exports = Room;


server.listen(port, function () {
	console.log('listening on *:' + port);
})
