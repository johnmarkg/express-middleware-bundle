(function () {
	var express = require('express');
	var debug = require('debug')('express-scaffold')

	var RedisStore = require('connect-redis')(require('express-session'));

	var Passport = require('passport').Passport
	var LocalStrategy = require('passport-local').Strategy;
	var LocalAPIKeyStrategy = require('passport-localapikey').Strategy;
	var RememberMeStrategy = require('passport-remember-me').Strategy;

	// var async = require("async");
	// var bytes = require("bytes");

	function Scaff(){
		// dont want cached object
		this.passport = new Passport();

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
		if(this.addedCookieParser){
			return this;
		}		
		var cookieParser = require('cookie-parser');
		this.app.use(cookieParser());
		this.addedCookieParser = true;
		return this;
	}	

	Scaff.prototype.addGzip = function(options) {
		debug('addGzip: ' + JSON.stringify(options || {}));
		if(this.addedGzip){
			return this;
		}

		var compression = require('compression')
		this.app.use(compression(options || {}));
		this.addedGzip = true;
		return this;
	}

	// Scaff.prototype.addRedisSessions = function(redisConfig, cookieDomain, secret, key) {
	Scaff.prototype.addRedisSessions = function(redisConfig, sessionConfig, cookieConfig) {		
		debug('addRedisSessions')

		if(!sessionConfig){
			sessionConfig = {};
		}

		if(!cookieConfig){
			cookieConfig = {};
		}

		
		this.addQueryAndBodyParser();

		if (!redisConfig) {
			throw new Error('redis config or client required')
		}

		// defaults
		var _config = {
			secret: 'do it',
			key: 'sessionId',
			store: new RedisStore(redisConfig),
			cookie: {
				httpOnly: true,
				maxAge: null //cookie destroyed browser when is closed
			},
			resave: true,
			saveUninitialized: false,
			secure: false
		};


		for(var key in sessionConfig){
			_config[key] = sessionConfig[key]
		}

		for(var key in cookieConfig){
			if(!_config.cookie){
				_config.cookie = {};
			}
			_config.cookie[key] = sessionConfig[key]
		}

		// if (sessionConfig.cookieDomain) {
		// 	_config.cookie.domain = sessionConfig.cookieDomain;
		// }

		var session = require('express-session');
		this.app.use(session(_config));

		return this;
	}


	Scaff.prototype.initPassport = function() {

		if(this.deserializeUser){
			this.passport.deserializeUser(this.deserializeUser);
		}

		if(this.serializeUser){
			this.passport.serializeUser(this.serializeUser);
		}

		if(!this.passportInitialized){
			this.app.use(this.passport.initialize());

			// this is strategy that check for cookies
			this.app.use(this.passport.session());
		}
		this.passportInitialized = true;

		return this;
	}


	Scaff.prototype.authenticationRememberMe = function(verify, issue) {
		debug('authenticationRememberMe');

		var t = this;
		this.verifyRememberMe = verify;
		this.issueRememberMe = issue;

		this.addCookieParser();

		this.passport.use(new RememberMeStrategy(t.verifyRememberMe, t.issueRememberMe));

		this.initPassport();
		this.rememberMe = true;
		this.app.use(this.passport.authenticate('remember-me'));

		return this;
	}

	Scaff.prototype.authenticationLogin = function(loginFn) {
		debug('authenticationLogin');

		if(this.addedAuthenticationLogin){
			debug('already added ')
			return this;
		}
		this.addedAuthenticationLogin = true;

		// default serialize user
		this.passport.serializeUser(function(user, done) {
			debug('default serializeUser: ' + JSON.stringify(user));
        	done(null, user.id);
      	});

		var local = new LocalStrategy({
			passReqToCallback: true
		}, loginFn);
		this.passport.use(local);

		return this.initPassport();
	}

	Scaff.prototype.authenticationApikey = function(authFn) {
		debug('authenticationApikey');

		this.passport.use(new LocalAPIKeyStrategy({
			passReqToCallback: true
		}, authFn));

		return this.initPassport();
	}

	Scaff.prototype.authenticateHandler= function(err, user, info, req, res, next) {	
		var t = this;
		debug('authenticationHandler')
		if (err) {
			debug('authenticationHandler: authentication error')
			return next(err);
		}
		if (!user) {
			debug('authenticationHandler: no user')
			return t.loginFail(req, res, info);
		}

		// debug('user: '+ JSON.stringify(user));

		// start and save session
		if(info && info.session){
			req.login(user, {session: true}, function(err) {
				
				debug('authenticationHandler: login')
				if (err) {
					debug('authenticationHandler: login err')
					return next(err);
				}

				if(t.rememberMe && req.body && req.body.remember_me){

					debug('authenticationHandler: remember me')
					t.issueRememberMe(req.user, function(err, token){
						if(err){
							debug('authenticationHandler: rememberMe err')
							return next(err);							
						}
						res.cookie('remember_me', token, { path: '/', httpOnly: true, maxAge: 604800000 });
						t.loginSuccess(req, res, user, info);
					})
				}
				else{
					t.loginSuccess(req, res, user, info);	
				}

			
			});						
		}

		// no session (api requests)
		// 
		// cant use req.login as  
		else{
			this.deserializeUser(user.id,function(err, _user){
				if(err){
					return next(err)
				}
				
				req.user = _user
				next()
			})
		}

	}

	Scaff.prototype.loginSuccess = function(req, res, info) {
		debug('loginSuccess')
		debug(JSON.stringify(req.user));
		req.user.adminUserView = (info && info.adminUserView);




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

	Scaff.prototype.authenticated = function(req, res, next) {
		var t = this

		// if (req.session && req.session.passport && req.session.passport.user) {
		if (!req.isAuthenticated()) {				
			debug('not authenticated, check apikey');

			// this.passport.authenticate('localapikey', { session: true})(req, res, next);

			this.passport.authenticate('localapikey', function(err, user, info) {
				t.authenticateHandler(err, user, info, req, res, next)
			})(req, res, next);
		}
		else{
			next()
		}
	}

	Scaff.prototype.start = function(port, cb) {

		var app = this.app;
		var t = this;

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

	Scaff.prototype.shutdown = function() {
		/* istanbul ignore else  */
		if (process.send) {
			process.send('offline');
		}

		this.server.close(function() {
			debug(process.pid + " Closed out remaining connections.")
		})

		var wait = (this.shutdownTimeout || 1 * 60 * 1000);
		setTimeout(function() {
			console.error(process.pid + " Could not close connections in time, forcefully shutting down (waited " + wait + "ms) ")
			process.exit(1)
		}, wait);
	}	

	Scaff.prototype.errorHandler = function(err, req, res, next) {
		debug('add erroraHandler')
		this.app.use(function(error, req, res, next){
			debug('errorHandler')
			// console.error(err.stack);

			// next(err);	
			if (req.xhr) {
				res.status(500).send({ error: 'Something blew up!' });
		 	} 
		 	else {
				res.status(500).send();
			}				
		})

		return this;

	}	



	Scaff.prototype.logout = function(req, res, next){


		// to pass unit tests using fakeredis
		req.session.cookie.maxAge = 1001

		// clear passport session
		req.logout();

		res.redirect('/'); //Inside a callback… bulletproof!

		// clear session in store
		// delay session destroy to send cookie with new expiration to client	
		setTimeout(function(){
			req.session.destroy();
		},50);
		
	};

	Scaff.prototype.login = function(req, res, next){
		var t = this;
	
		this.passport.authenticate('local', function(err, user, info) {
			debug('local authentication')
			if(!info){
				info = {};
			}
			info.session = true;
			t.authenticateHandler(err, user, info, req, res, next);
		})(req, res, next);
	}




})(this);