(function() {

	var util = require('util');
    var events = require('events');
	var assign = require('object.assign').getPolyfill();
	var debug = require('debug')('service-scaff')
	var express = require('express');


	function Scaff(modules) {

		events.EventEmitter.call(this)

		this.rememberMeCookieLabel = 'rememberMe'
		this.sessionCookieLabel = 'sessionId'
		this.debug = debug;

		var lib = [
			'command-line',
			'errors',
			'middleware',
			'static',
			'email',
			'sessions',
			'status',
			'config',
			'rabbit',
			'roles',
			'resources',
			'register',
			'morgan',
			'resources/rabbit',
			'resources/redis',
			'resources/mysql',
			'resources/mongo',
			'resources/sphinxql',
			'auth',
			'auth/apikey',
			'auth/remember-me',
			'auth/user-pass'
		]

		if(modules){
			lib = modules
		}

		var t = this;
		t.modules = {};
		lib.forEach(function(file){
			// console.info(file)
			if(t.modules[file]){ return; }
			debug('load module: ' + file)
			t.modules[file] = true;

			var mod = require('./lib/' + file + '.js');

			// factories
			if(typeof mod == 'function'){
				t[mod.name] = mod();
				return;
			}

			// standard exports
			assign(t, mod)

		})

		return this;
	}

	util.inherits(Scaff, events)


	// export factory function
	exports = module.exports = function(modules){
		return new Scaff(modules)
	};

	// use this to get a new, non cached object
	Scaff.prototype.ServiceScaff = function(modules) {
		return new Scaff(modules);
	};

	Scaff.prototype.serviceScaff = function(modules) {
		return new Scaff(modules);
	};


	Scaff.prototype.express = function() {

		if(this.app){ return this; }

		this.app = express();
		this.app.disable('x-powered-by');

		// bind express functions to this
		this.set = this.app.set.bind(this.app)
		this.use = this.app.use.bind(this.app)
		this.get = this.app.get.bind(this.app)
		this.post = this.app.post.bind(this.app)
		this.delete = this.app.delete.bind(this.app)
		this.put = this.app.put.bind(this.app)

		this.app.redis = this.redis.bind(this)
		this.app.mysql = this.mysql.bind(this)
		this.app.mongo = this.mongo.bind(this)
		this.app.sphinxql = this.sphinxql.bind(this)

        this.app.rabbitSend = this.rabbitSend.bind(this)
        this.app.rabbitRequest = this.rabbitRequest.bind(this)

		this.app.setStatus = this.setStatus.bind(this)
		this.app.getStatus = this.getStatus.bind(this)
		this.app.getStatusAll = this.getStatusAll.bind(this)
		this.app.incrementStatus = this.incrementStatus.bind(this)

		this.app.sendEmail = this.sendEmail.bind(this);

		return this;
	};

	Scaff.prototype.web = function() {
		this
			.express()
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser()
			.addRedisSessions()
			.authenticationRememberMe()
			.authenticationApikey()
			.authenticationLogin()

		return this;
	}

	Scaff.prototype.api = function() {
		this
			.express()
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser()
			.addRedisSessions()
			.authenticationApikey()

		return this;
	}

	//----------------------------------------
	// start/stop server
	//----------------------------------------
	Scaff.prototype.start = function(port, cb) {

		this.express();

		var app = this.app;

		var t = this;

		if (typeof port == 'undefined') {
			throw new Error('port required')
		}


		// if(t._register){
		// 	var host = t.config('register').routers[0].host
		// 	var port = t.config('register').routers[0].port
		//
		// 	var seaport = require('seaport');
		// 	var ports = seaport.connect({
		// 		host: host || 'localhost',
		// 		port: 59001,
		// 	});
		//
		// 	var _port = app.listen(
		// 		ports.register(t._register, { aliases: t._registerAliases } ),
		//
		// 		function(err){
		// 			up(err, _port.address().port)
		// 		}
		// 	);
		// }
		// else{

			app.listen(port, function(err) {
				t.server = this;
				debug(
					process.title + " listening on port %d (pid: " + process.pid + ")",
					this.address().port
				);

				up(err, this.address().port)
			});
		// }

		function up(err, _port){
			t.emit('online', _port)
			t._port = _port;

			if (process.send) {
				// for naught
				process.send('online');
			}
			if (cb && typeof cb === 'function') {
				cb(err, _port);
			}
		}

		/* istanbul ignore next */
		process.on('message', function(message) {
			if (message === 'shutdown') {
				debug(process.pid + " Received shutdown message, shutting down gracefully.")
				t.shutdown();
			}
		});

		/* istanbul ignore next */
		process.on('SIGTERM', function() {
			console.log(process.pid + " Received kill signal (SIGTERM), shutting down gracefully.")
			t.shutdown();
		})
	}

	Scaff.prototype.shutdown = function(msg) {

		this.server.close(function() {
			debug("server stopped accepting connections")
			if(msg){
				console.info(msg)
			}

			if (process.send) {
				process.send('offline');
			}
		})
		// var t = this;
		// var wait = (this.shutdownTimeout || 1 * 60 * 1000);
		// setTimeout(function() {
		// 	console.error(process.pid + " Could not close connections in time, forcefully shutting down (waited " + wait + "ms) ")
		// 	delete t.server;
		// 	// process.exit(1)
		// }, wait);
	}


})(this);
