(function () {
	var express = require('express');
	var debug = require('debug')('express-scaffold')

	var RedisStore = require('connect-redis')(require('express-session'));

	var passport = require('passport');
	var LocalStrategy = require('passport-local').Strategy;
	var LocalAPIKeyStrategy = require('passport-localapikey').Strategy;



	// var async = require("async");
	// var bytes = require("bytes");

	function Scaff(){
		this.app = express();
		this.app.disable('x-powered-by');
		return this;
	}

	// export constructor
	module.exports = new Scaff();
	Scaff.prototype.ExpressScaffold = function(){
		return new Scaff();
	};

	Scaff.prototype.addQueryAndBodyParser = function() {
		debug('addQueryAndBodyParser')
		var bodyParser = require('body-parser');

		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({
			extended: false
		}));

		return this;
	}

	Scaff.prototype.addCookieParser = function() {
		debug('addCookieParser')
		var cookieParser = require('cookie-parser');
		this.app.use(cookieParser());
		return this;
	}	

	Scaff.prototype.addGzip = function(options) {
		debug('addGzip')
		var compression = require('compression')
		this.app.use(compression(options || {}));
		return this;
	}

	Scaff.prototype.addRedisSessions = function(redisConfig, cookieDomain, secret, key) {
		debug('addRedisSessions')

		this.addCookieParser();

		if (!redisConfig) {
			throw new Error('redisConfig required')
		}

		var redis = new RedisStore(redisConfig);

		var _config = {
			secret: secret || 'do it',
			key: key || 'v4-patentcamId',
			store: redis,
			cookie: {
				httpOnly: true,
				maxAge: null
			},
			resave: false,
			saveUninitialized: false
		};
		if (cookieDomain) {
			_config.cookie.domain = cookieDomain;
		}


		var session = require('express-session');
		this.app.use(session(_config));

		// this.authentication();
		// this.app.use(this.showChildRecords)

		return this;
	}


	Scaff.prototype.initPassport = function() {

		if(this.deserializeUser){
			passport.deserializeUser(this.deserializeUser);
		}

		if(!this.passportInitialized){
			this.app.use(passport.initialize());
			this.app.use(passport.session());
		}
		this.passportInitialized = true;

		return this;
	}

	Scaff.prototype.authenticationLogin = function(loginFn) {
		debug('authenticationLogin');
		var app = this.app;

		passport.serializeUser(function(user, done) {
        	done(null, user.id);
      	});

		var local = new LocalStrategy({
			passReqToCallback: true
		}, function(req, username, password, done) {
			loginFn(req, username, password, done)
		});
		passport.use(local);


		this.initPassport();

		return this;
	}

	Scaff.prototype.logout = function(req, res, next){
	   	req.logout();
	   	res.redirect('/');
	};

	Scaff.prototype.login = function(req, res, next){
		var t = this;
	
		passport.authenticate('local', function(err, user, info) {
			debug('local authentication')
			t.authenticateHandler(err, user, info, req, res, next);
		})(req, res, next);
	}

	Scaff.prototype.authenticateHandler= function(err, user, info, req, res, next) {	
		var t = this;
		if (err) {
			return next(err);
		}
		if (!user) {
			return t.loginFail(req, res, info);
		}

		req.login(user, req, function(err) {
			if (err) {
				return next(err);
			}
			t.loginSuccess(req, res, user, info);
		});
	}

	Scaff.prototype.loginSuccess = function(req, res, info) {
		req.session.adminUserView = (info && info.adminUserView);

		res.status(200)
		return res.json({
			success: true
		});				
	}

	Scaff.prototype.loginFail = function(req, res, info) {

		res.status(401)
		return res.json({
			success: false,
			error: info.message
		});
	
	}	

	Scaff.prototype.authenticationApikey = function(authFn) {
		debug('authenticationApikey');
		var app = this.app;

		passport.use(new LocalAPIKeyStrategy({
			passReqToCallback: true
		}, authFn));

		this.initPassport();

		return this;
	}

	Scaff.prototype.authenticated = function(req, res, next) {
		var t = this

		if (!req.isAuthenticated()) {				
			debug('not authenticated, check apikey');

			passport.authenticate('localapikey', function(err, user, info) {
				t.authenticateHandler(err, user, info, req, res, next)

			})(req, res, next);
		}
		else{
			next()
		}
	}

	Scaff.prototype.start = function(port, cb) {

		var app = this.app;

		if (!port) {
			throw new Error('port required')
		}

		this.server = app.listen(port, function() {
			debug(
				process.title + " listening on port %d (pid: "+ process.pid +  ")",
				port
			);

			// for naught
			if (process.send) {
				process.send('online');
			}
			if (cb && typeof cb === 'function') {
				cb();
			}
		});

		

		process.on('message', function(message) {
			if (message === 'shutdown') {
				debug(process.pid + " Received shutdown message, shutting down gracefully.")
				server.shutdown();
			}
		});

		process.on('SIGTERM', function() {
			console.log(process.pid + " Received kill signal (SIGTERM), shutting down gracefully.")
			server.shutdown();
		})

	}	

	Scaff.prototype.shutdown = function() {
		//sendOfflineMessage();
		if (process.send) {
			process.send('offline');
		}

		this.server.close(function() {
			debug(process.pid + " Closed out remaining connections.")
			// sendOfflineMessage();
			// process.exit(0)
		})

		var wait = (this.shutdownTimeout || 1 * 60 * 1000);
		setTimeout(function() {
			console.error(process.pid + " Could not close connections in time, forcefully shutting down (waited " + wait + "ms) ")
			process.exit(1)
		}, wait);
	}	


})(this);