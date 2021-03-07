'use strict';
let online = false; // set online
let debugStats = false; // report stats
let developBranch = false; // dev mode (false for production)

// custom port
let tPort = process.env.PORT || 5000;
for(let arg of process.argv){
	if(!isNaN(arg)){
		tPort = arg;
	}
}

// https mode
let useHTTPS = false;
if(process.argv.indexOf('https') > -1){
	useHTTPS = true;
}


const express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require('socket.io')(server)
, RGA = (online) ? require('./js/rga.js') : require('./includes/js/rga.js') // remove includes for online
, port = tPort
, https = require('https')
, fs = require('fs')
, pem = require('pem')
, httpProxy = require('http-proxy')


// HTTPS
const pemPath = './includes/ssl/pem';
const portHTTPS = parseInt(tPort) + 1;

if(useHTTPS){
	pem.createCertificate({ days: 60, selfSigned: true }, (err, keys) => {
		if (!err) {
			fs.readFile(pemPath, (err, json) => {
				if (!err) {
					const keys = JSON.parse(json);
					//console.log('old keys')
					startServer(keys);
				}else{
					fs.writeFile(pemPath, JSON.stringify(keys), { mode: 0o444 }, (err) => {
						if (!err) {
							//console.log('new keys')
							startServer(keys);
						}
					});
				}
			});
		}
	});
}

function startServer(keys){
	httpProxy.createServer({
		target: {
			host: 'localhost',
			port: tPort
		},
		ssl: {
			key: keys.serviceKey,
			cert: keys.certificate
		},
		ws: true
	}).listen(portHTTPS, ()=>{
		let os = require('os');
		let ip = Object.values(os.networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat(i.family==='IPv4' && !i.internal && i.address || []), [])), []);
		console.log('HTTPS for PEERS! share » https://' + ip + ':' + portHTTPS + ' || https://' + os.hostname() + ':' + portHTTPS);
	});
}

// OSC
let iop, osc, oscServer, oscClient, isConnected;
if(!online){
	iop = require('socket.io', {transports: ['WebSocket'] }).listen(8082);
	osc = require('node-osc');
}

const maxSpaces = 500; // check memory for number of namespaces...
const purgeCounter = 24; // hours until removing namespace
let cc = new Object(); // store namespaces
let ccStatsReporting = (online) ? 60 : 15; // sec
let ccStatsWriting = 60; // min
let ccStats = {'time':timestamp(), 'cc':0, 'ns':0, 'nsMax':0, 'nsTwo':0, 'sd':0, 'max':{}, 'nsMap':[]};
let ccStatsMaxCounter = 0;
initMaxStats();

/* STATS */
function setupStats(){
	if(debugStats){
		setInterval(function(){
			reportStats();
			console.log(JSON.stringify(ccStats));
		}, 1000 * ccStatsReporting); // sec

		setInterval(function(){
			hourlyStats();
		}, 1000 * 60 * ccStatsWriting); // min
	}
}

function hourlyStats(){
	let writeStats = JSON.stringify(ccStats) + '\n';
	let dir = './_stats';
	!fs.existsSync(dir) && fs.mkdirSync(dir);
	fs.writeFile(dir + '/P5L_STATS_' + new Date().getFullYear()+'-' + tPort + '.txt', writeStats, { flag: 'a+' }, err => {})
	ccStatsMaxCounter++;
	if(ccStatsMaxCounter >= 24){
		initMaxStats(); // start max count over
	}
	//console.log('writing hourlyStats...');
}

function initMaxStats(){
	ccStats.nsMax = 0;
	ccStats.max = {cc:0, ns:0, nsMax:0, nsTwo:0, sd:0, sdMax:0};
}

function reportStats(){
	ccStats.cc = 0;
	ccStats.sd = 0;
	ccStats.nsTwo = 0;
	ccStats.nsMap = [];
	ccStats.time = timestamp();
	ccStats.ns = 0;
	for(let i=0; i < Object.keys(cc).length; i++){
		let ccRaw = Object.keys(cc)[i];
		if(cc[ccRaw] !== undefined && Object.keys(cc[ccRaw].settings.people) !== undefined){
			let ccCount = Object.keys(cc[ccRaw].settings.people).length;

			// max cc
			if(ccCount > ccStats.nsMax){
				ccStats.nsMax = ccCount;
				if(ccCount > ccStats.max.ns){
					ccStats.max.nsMax = ccCount;
				}
			}

			ccStats.cc += ccCount;
			if(ccCount > 2){
				ccStats.nsMap.push(ccCount);
			}else if(ccCount == 2){
				ccStats.nsTwo++;
			}

			if(ccCount > 0){
				ccStats.ns++;
			}

			for (var key in cc[ccRaw].settings.people) {
				if (!cc[ccRaw].settings.people.hasOwnProperty(key)) continue;

				var obj = cc[ccRaw].settings.people[key];
				if(obj.usesyncdata){
					ccStats.sd++;
				}
			}
		}
	}
	ccStats.nsMap.sort(function(a, b){return b-a});


	if(ccStats.cc > ccStats.max.cc){
		ccStats.max.cc = ccStats.cc;
	}

	if(ccStats.ns > ccStats.max.ns){
		ccStats.max.ns = ccStats.ns;
	}

	if(ccStats.nsMap.length > ccStats.max.ns){
		ccStats.max.ns = ccStats.nsMap.length;
	}

	if(ccStats.nsTwo > ccStats.max.nsTwo){
		ccStats.max.nsTwo = ccStats.nsTwo;
	}

	if(ccStats.sd > ccStats.max.sd){
		ccStats.max.sd = ccStats.sd;
	}
}

setupStats();

function timestamp(){
	return new Date().toISOString().replace(/[^0-9]/g, '_').slice(0, -5);
}


function hashCode(s) {
	let h;
	for(let i = 0; i < s.length; i++)
		h = Math.imul(31, h) + s.charCodeAt(i) | 0;

	return h;
}

// mute .map files!
app.use(function (req, res, next) {
	if(req.path.match(/\.map$/i)) {
		res.send('');
	}else{
		next()
	}
})

app.get('/', function (req, res) {
	if(online && !developBranch){
		res.redirect('https://teddavis.org/p5live');
	}else{
		res.sendFile(__dirname + '/index.html');

		let ccRaw = req.query.cc; // get namespaces
		if(ccRaw != null && ccRaw.length == 5){
			if(cc[ccRaw] === undefined || cc[ccRaw] === null){
				// create room if under limit
				if(Object.keys(cc).length < maxSpaces){
					cc[ccRaw] = new Namespace(ccRaw, io);
				}else{
					// report rooms are full
					io.of('/' + ccRaw).on('connection', function(socket){
						socket.emit('full');
					});
				}
			}
		}
	}
})

// backup sketches
if(!online){
	app.post('/backup', express.json({limit: '5mb', type: '*/*'}), (req, res) => {
	  // res.json(req.body);
	  let dir = './_backups';
	  !fs.existsSync(dir) && fs.mkdirSync(dir);

	  fs.writeFile(dir + '/P5L_BACKUP_'+tPort+req.body.timestamp+'.json', JSON.stringify(req.body.sketches, undefined, 2), { flag: '' }, err => {})
	  res.send('OK');
	});

	app.get('/fancy', express.json({type: '*/*'}), (req, res) => {
	  res.send('fancy');
	});
}

io.set('transports', ['websocket']);

io.origins((origin, callback) => {
	if (online && origin !== 'https://teddavis.org' && !developBranch) {
		return callback('origin not allowed', false);
	}
	callback(null, true);
});

// OSC
// let oscConnected = 0, oscDisconnected = 0; // debugger... fixed now??
if(!online){
	iop.sockets.on('connection', function (socket) {
		socket.on('config', function (obj) {
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
				socket.emit('message', msg);
			});
			socket.emit('connected', 1);
		});
		socket.on('message', function (obj) {
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

// must be after app.get()!
if(!online){
	app.use(express.static('./')); //, { maxAge: 3600000 } enable 1-hour cache for fast local loading
}

function purgeNamespace(nsp){
	delete cc[nsp];
}

// tip for using socket in class!
// https://stackoverflow.com/q/42998568/10885535
class Namespace {
	constructor(name, io) {
		this.settings = {
			reset: function() {
				Object.assign(this, {
					'name' : name
					, 'token' : hashCode(name)
					, 'users' : {}
					, 'people' : {}
					, 'chat' : []
					, 'rga': new RGA(0)
					, 'userId': 0
					, 'lockdown' : false
					, 'purgeTimer' : null
					, 'sync' : false
					, 'fc' : 0
					, 'request' : false
					, 'hasAdmin' : false
					, 'purgeTimer' : null
					, 'purgeCounter' : purgeCounter
				})
			},
			clearHistory: function() {
				Object.assign(this, {
					'rga': new RGA(0)
					, 'fc' : 0
				})
			}
		}
		this.settings.reset(); // init values

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
			settings.people[socket.id] = {'nick':socket.handshake.query.nick, 'status':'focus', 'request':false, 'writemode':false, 'cursor':{'row':0, 'column':0}, 'color':'#00aa00', 'usesyncdata':false};
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
					settings.purgeTimer = setTimeout(function(){
						settings.reset(); // really removes code/chat
						purgeNamespace(settings.namespace); // sets to undefined
					}, (1000 * 60 * 60 * settings.purgeCounter)); // hours
				}
			});

			socket.emit('welcome', {id: settings.userId, history: settings.rga.history()})
			socket.emit('cocodeReady');
			socket.emit('syncChat', settings.chat);

			if(settings.userId == 1){
				socket.emit('init');
			}

			RGA.tieToSocket(settings.rga, socket);

			socket.on('login', function(newid){
				if(settings.people[socket.id] !== undefined){
					// check existing name, add random id if so
					let flatUsers = JSON.stringify(settings.people);
					if(flatUsers.indexOf('"'+newid+'"') > -1 ){
						let suffix = Math.floor(Math.random()*99);
						newid += '_'+suffix;
						socket.emit('rename', newid);
					}
					settings.people[socket.id].nick = newid;
					syncChat();
					syncSettings();
				}
			})

			socket.on('updateColor', function(newcolor){
				if(settings.people[socket.id] !== undefined){
					settings.people[socket.id].color = newcolor;
					syncChat();
					syncSettings();
				}
			})

			socket.on('token', function(token){
				if(settings.people[socket.id] !== undefined){
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
				}
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
				if(settings.people[socket.id] !== undefined){
					settings.people[socket.id].status = statusMode;
					syncUsers();
				}
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
				settings.clearHistory(); // ***
				// RGA.tieToSocket(settings.rga, socket);
				// io.of(settings.name).emit('rgaReconnect');
				socket.emit('codeReplace', reqData);
			})

			socket.on('editRequest', function(reqData){
				if(settings.people[socket.id] !== undefined){
					settings.people[socket.id].request = reqData.mode;
					syncUsers();
				}
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
				if(settings.people[socket.id] !== undefined){
					settings.people[socket.id].cursor = pos;
					syncCursors();
				}
			});

			socket.on('syncData', function(obj){
				if(settings.people[socket.id] !== undefined){
					let syncdataActive = settings.people[socket.id].usesyncdata;
					if((syncdataActive != obj.usesyncdata)){
						settings.people[socket.id].usesyncdata = obj.usesyncdata;
						syncSettings();
					}

					if(JSON.stringify(obj).length > ccStats.max.sdMax){
						ccStats.max.sdMax = JSON.stringify(obj).length;
					}
					io.of(settings.name).emit('syncData', obj);
				}
			});

			socket.on('chat', function(obj){
				if(settings.people[socket.id] !== undefined){
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
			io.of(settings.name).emit('syncUsers', JSON.stringify(settings.people)); // update users for all
		}

		let syncSettings = function(){
			checkAdmin();
			let tempSettings = {'lockdown' : settings.lockdown, 'sync' : settings.sync, 'fc' : settings.fc, 'hasAdmin':settings.hasAdmin};
			io.of(settings.name).emit('syncSettings', JSON.stringify(tempSettings)); // update users for all
			syncUsers();
		}

		let syncCursors = function(){
			io.of(settings.name).emit('syncCursors', JSON.stringify(settings.people)); // update users for all
		}

		let clearPendingChat = function(){
			io.of(settings.name).emit('clearPendingChat'); // update users for all
		}

		let addChat = function(obj){
			io.of(settings.name).emit('addChat', obj); // update users for all
		}

		let syncChat = function(){
			let chatMsgs = [];
			for(let c of settings.chat){
				if(settings.people[c.id] !== undefined){
					c.nick = settings.people[c.id].nick;
					c.color = settings.people[c.id].color;
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
