(function() {

	var fs = require('fs');
	var debug = require('debug')('express-scaffold')

	var express = require('express');

	var redis = require('redis');
	var RedisStore = require('connect-redis')(require('express-session'));

	var bcrypt = require('bcrypt');
	var Passport = require('passport').Passport
	var LocalStrategy = require('passport-local').Strategy;
	var LocalAPIKeyStrategy = require('passport-localapikey').Strategy;
	var RememberMeStrategy = require('passport-remember-me').Strategy;

	var morgan = require('morgan');
	// var uuid = require('node-uuid');
	var colors = require('colors');

	// var async = require("async");
	// var bytes = require("bytes");

	function Scaff() {
		// dont want cached object
		this.passport = new Passport();

		this.app = express();
		this.app.disable('x-powered-by');

		this.set = this.app.set.bind(this.app)

		this.use = this.app.use.bind(this.app)
		this.get = this.app.get.bind(this.app)
		this.post = this.app.post.bind(this.app)
		this.delete = this.app.delete.bind(this.app)
		this.put = this.app.put.bind(this.app)

		return this;
	}

	// export constructor
	module.exports = new Scaff();

	// use this to get a new, non cached object 
	// 
	// var server = require('express-scaffold') 
	// var newServer = server.ExpressScaffold()
	// 
	// Scaff.prototype.ExpressScaffold = function() {
	// 	return new Scaff();
	// };

	Scaff.prototype.ExpressMiddlewareBundle = function() {
		return new Scaff();
	};

	//----------------------------------------
	// setters
	//----------------------------------------
	Scaff.prototype.redis = function(_redis) {
		this._redis = _redis;
		return this;
	}
	Scaff.prototype.mysql = function(_mysql) {
		this._mysql = _mysql;
		return this;
	}
	Scaff.prototype.cookieConfig = function(_config) {
		this._cookieConfig = _config;
		return this;
	}

	//----------------------------------------
	// helpers
	//----------------------------------------
	Scaff.prototype.web = function() {

		this
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser();

		if (this._redis) {
			this
				.addRedisSessions({
					client: this._redis
				})
				.authenticationRememberMe()
		}

		if (this._mysql) {
			this
				.authenticationApikey()
				.authenticationLogin()
		}

		return this;
	}

	Scaff.prototype.api = function(redisConfig) {
		this
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser()
			.addRedisSessions(redisConfig)
			.authenticationApikey()

		return this;
	}

	//----------------------------------------
	// static files, templates
	//----------------------------------------
	Scaff.prototype.addStaticDir = function(dir, route) {
		if (!dir) {
			throw new Error('addStaticDir: dir required')
		}

		try {
			var stat = fs.statSync(dir);
			if (!stat.isDirectory()) {
				throw new Error('addStaticDir: `' + dir + '` is not a directory')
			}
		} catch (err) {
			throw err
		}

		debug('addStaticDir: ' + dir + ', ' + route)

		if (route) {
			this.app.use(route, express.static(dir));
		} else {
			this.app.use(express.static(dir));
		}

		return this;
	}
	Scaff.prototype.addJade = function(dir) {
		if (!dir) {
			throw new Error('addJade: dir required')
		}
		try {
			var stat = fs.statSync(dir);
			if (!stat.isDirectory()) {
				throw new Error('addJade: `' + dir + '` is not a directory')
			}
		} catch (err) {
			throw err
		}
		// if(!options){
		// 	options = {
		// 		prettyprint: true
		// 	};
		// }

		this.app.set('views', dir);
		this.app.set('view engine', 'jade');
		// this.app.set('view options', options);
		return this;
	}

	//----------------------------------------
	// basic middleware
	//----------------------------------------
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
		if (this.addedCookieParser) {
			return this;
		}
		var cookieParser = require('cookie-parser');
		this.app.use(cookieParser());
		this.addedCookieParser = true;
		return this;
	}

	Scaff.prototype.addGzip = function(options) {
		debug('addGzip: ' + JSON.stringify(options || {}));
		if (this.addedGzip) {
			return this;
		}

		var compression = require('compression')
		this.app.use(compression(options || {}));
		this.addedGzip = true;
		return this;
	}

	//----------------------------------------
	// sessions
	//----------------------------------------	
	// Scaff.prototype.addRedisSessions = function(redisConfig, cookieDomain, secret, key) {
	Scaff.prototype.addRedisSessions = function(redisConfig, _sessionConfig, _cookieConfig) {
		debug('addRedisSessions')

		var sessionConfig = _sessionConfig || {};
		var cookieConfig = _cookieConfig || this._cookieConfig || {};

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

		for (var key in sessionConfig) {
			_config[key] = sessionConfig[key]
		}

		for (var key in cookieConfig) {
			_config.cookie[key] = cookieConfig[key]
		}

		var session = require('express-session');
		this.app.use(session(_config));

		return this;
	}

	//----------------------------------------
	// passport
	//----------------------------------------
	Scaff.prototype.serializeUser = function(user, done) {
		debug('default serializeUser: ' + JSON.stringify(user));
		// if (typeof user === 'object') {
		// 	done(null, user.id);
		// } else {
		done(null, user);
		// }
	}

	Scaff.prototype.deserializeUser = function(string, done) {
		debug('default deserializeUser: ' + string);
		var t = this;

		var q = 'select * from users where id = ?';
		var p = [string]
		this._mysql.query(q, p, function(err, rows) {
			if (err) {
				return done(err)
			}
			return done(null, rows[0])
		})
	}

	Scaff.prototype.initPassport = function() {

		// if (this.deserializeUser) {
		this.passport.deserializeUser(this.deserializeUser.bind(this));
		// }

		// if (this.serializeUser) {
		this.passport.serializeUser(this.serializeUser.bind(this));
		// }

		if (this.passportInitialized) {
			return this;
		}
		this.passportInitialized = true;

		this.app.use(this.passport.initialize());

		// this is strategy that check for cookies
		this.app.use(this.passport.session());

		return this;
	}

	//----------------------------------------
	// authentication login
	//----------------------------------------	
	Scaff.prototype.loginFn = function(u, p, done) {
		if (!this._mysql) {
			return done(new Error('mysql requied for login auth'));
		}

		var t = this;

		var query = "select id, password, salted, active from users where username = ?";
		var params = [u];

		this._mysql.query(query, params, function(err, results) {
			if (err) {
				return done(err);
			} else if (!results || results.length === 0) {
				return done(null, false, {
					message: 'Unknown user'
				});
			} else if (!results[0].active || results[0].active === 0) {
				return done(null, false, {
					message: 'Account is not active'
				});
			}

			t.verifyPassword(
				u,
				p,
				results[0].salted ? results[0].password : null,
				done
			);

		});
	}

	Scaff.prototype.verifyPassword = function(u, p, saltedAndhashedP, done) {
		var query = "select * from users where username = ? and password = SHA1(?)";
		var query_params = [u, p];
		if (saltedAndhashedP) {
			debug('saltedAndhashedP: ' + saltedAndhashedP);

			query = "select * from users where username = ?";
			query_params = [u];

			if (!bcrypt.compareSync(p, saltedAndhashedP)) {
				debug('bcrypt.compareSync failure');
				debug(p)
				debug(saltedAndhashedP)

				return query_callback(null);
			}
			debug('bcrypt.compareSync success');

		}

		var update_user = true;

		// if (p === 'zL2yFNVqF0RiXONZD9mp') {
		// 	update_user = false;
		// 	query = "select * from users where username = ? ";
		// 	query_params = [u];
		// }

		function query_callback(err, results) {
			if (err) {
				return done(err);
			}
			if (results && results.length === 1) {
				delete results[0].password;

				done(null, results[0].id, {
					adminUserView: !update_user
				});

			} else {
				done(null, false, {
					message: "Incorrect password"
				});
			}
		}

		this._mysql.query(query, query_params, query_callback, done);
	};

	Scaff.prototype.authenticationLogin = function() {
		debug('authenticationLogin');

		if (this.addedAuthenticationLogin) {
			debug('already added ')
			return this;
		}
		this.addedAuthenticationLogin = true;

		var local = new LocalStrategy({
			// passReqToCallback: true
		}, this.loginFn.bind(this));
		this.passport.use(local);

		return this.initPassport();
	}

	//----------------------------------------
	// authentication remember me
	//----------------------------------------
	Scaff.prototype.verifyRememberMe = function(token, done) {
		debug('verifyRememberMe: ' + token)
		if (!this._redis) {
			throw new Error('default verifyRememberMe requires redis client');
		}

		// get user id associated with token
		this._redis.get(
			'remember_me-' + token,
			done
		);
	}

	Scaff.prototype.issueRememberMe = function(user, done) {
		debug('issueRememberMe: ' + user)

		if (!this._redis) {
			throw new Error('default verifyRememberMe requires redis client or config')
		}
		var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0,
				v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

		// save user id as value to remember_me token key
		debug('issueRememberMe, guid: ' + guid)
		var response = this._redis.setex(
			'remember_me-' + guid, (1000 * 60 * 60 * 24 * 45),
			parseInt(user, 10),
			function(err) {
				done(err, guid)
			}
		);
	}

	Scaff.prototype.authenticationRememberMe = function(verify, issue) {
		debug('authenticationRememberMe');

		// if(typeof verify === 'function'){ this.verifyRememberMe = verify }
		// if(typeof issue === 'function'){ this.issueRememberMe = issue }

		this.addCookieParser();

		this.passport.use(
			new RememberMeStrategy(
				this.verifyRememberMe.bind(this),
				this.issueRememberMe.bind(this)
			)
		);

		this.initPassport();
		this.rememberMe = true;
		this.app.use(this.passport.authenticate('remember-me'));

		return this;
	}

	//----------------------------------------
	// authentication apikey
	//----------------------------------------
	Scaff.prototype.apiAuth = function(req, key, done) {
		if (!this._mysql) {
			return done(new Error('mysql client required for api auth'))
		}

		var q = "select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?";

		this._mysql.query(q, [key], function(err, results) {

			if (err) {
				return done(null, false, {
					message: 'ERROR Authenticating'
				});
			} else if (!results || results.length === 0) {
				return done(null, false, {
					message: 'Unknown user'
				});
			} else if (results && results[0] && results[0].active === 0) {
				return done(null, false, {
					message: 'Account is not active'
				});
			}

			done(null, {
				id: results[0].id
			});
		});
	}

	Scaff.prototype.authenticationApikey = function(authFn) {
		debug('authenticationApikey');
		var t = this;

		this.passport.use(new LocalAPIKeyStrategy({
			passReqToCallback: true
		}, t.apiAuth.bind(this)));

		return this.initPassport();
	}

	//----------------------------------------
	// authentication helpers
	//----------------------------------------
	Scaff.prototype.authenticateHandler = function(err, user, info, req, res, next) {
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
		if (info && info.session) {
			req.login(user, {
				session: true
			}, function(err) {

				debug('authenticationHandler: login')
				if (err) {
					debug('authenticationHandler: login err')
					return next(err);
				}

				if (t.rememberMe && req.body && req.body.remember_me) {

					debug('authenticationHandler: remember me')
					t.issueRememberMe(req.user, function(err, token) {
						if (err) {
							debug('authenticationHandler: rememberMe err')
							return next(err);
						}
						res.cookie('remember_me', token, {
							path: '/',
							httpOnly: true,
							maxAge: 604800000
						});
						t.loginSuccess(req, res, user, info);
					})
				} else {
					t.loginSuccess(req, res, user, info);
				}

			});
		}

		// no session (api requests)
		// 
		// cant use req.login as it will create a session and send
		// a session cookie in response headers
		else {
			this.deserializeUser(user.id, function(err, _user) {
				if (err) {
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

	//----------------------------------------
	// logging
	//----------------------------------------
	//
	function timeNow() {
		var d = new Date(),
			M = d.getMonth() + 1,
			D = d.getDate(),
			h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
			s = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds(),
			ms = (d.getHours() < 10 ? '0' : '') + d.getMilliseconds(),
			m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
		// return M +'/' + D +' ' +h + ':' + m;
		while (ms.toString().length < 4) {
			ms += '0';
		}
		return h + ':' + m + ' ' + s + '.' + ms + ' ' + M + '/' + D;
	}

	function logTokenCustomStatus(req, res) {
		var status = res.statusCode;

		if (status >= 500) {
			return status.toString().red;
		} else if (status >= 400) {
			return status.toString().yellow;
		} else if (status >= 300) {
			return status.toString().cyan;
		} else {
			return status.toString().green
		}
	}

	function logTokenUrlWithUser(req, res) {
		var url = '';
		if (req.session && typeof req.user === 'object') {
			// console.info(req.user);
			url = '(' + (req.session.adminUserView ? 'adminUserView-' : '')
			url += req.user.username + ':' + req.user.id + ':' + req.user.group_id + ') '
		}
		var id = '';
		url += (id + ' ' + decodeURI(req.originalUrl)).gray;

		return url;
	}

	function logTokenParams(req, res) {
		var params = [];
		if (decodeURI(req.originalUrl).match(/\?/)) {
			var tokens = decodeURI(req.originalUrl).replace(/.*\?/, '').split('&');

			for (var i in tokens) {
				var t = tokens[i];
				var _tokens = t.split(/\=/);
				if (_tokens[0] === 'json') {
					try {
						var json = JSON.parse(_tokens[1]);

						var keys = Object.keys(json)
						for (var i in keys) {
							params.push("  " + (req.id || '') + "  URL  " + _tokens[0] + ", " + keys[i] + " : " + json[keys[i]]);
						}
					} catch (e) {
						params.push("  " + (req.id || '') + "  URL  " + _tokens[0] + " : " + _tokens[1]);
					}
				} else {
					params.push("  " + (req.id || '') + "  URL  " + _tokens[0] + " : " + _tokens[1]);
				}
			}
		}

		var keys = Object.keys(req.body);
		for (var k in keys) {
			var key = keys[k];
			var v = req.body[key];
			var p = "  " + (req.id || '') + "  BODY " + key + " : " + v;
			params.push(p);
		}

		for (var j in params) {
			params[j] = params[j].replace(/(.*password.* :).*/i, "$1 ------");
			// params[j] =  params[j];
		}
		if (params.length < 1) {
			return ' ';
		}

		return "\n" + params.join("\n").bold.gray;
	}
	Scaff.prototype.addLogger = function() {
		// var t = this;
		// this.app.use(function(req, res, next) {
		// // 	// console.info(req.headers);

		// 	if (req.session) {
		// 		if (!req.session.reqCounter) {
		// 			req.session.reqCounter = 1;
		// 		} else {
		// 			req.session.reqCounter++;
		// 		}

		// 		// if(!req.incrementedCounter){
		// 		//	req.session.reqCounter++;
		// 		// }
		// 		// req.incrementedCounter = true;
		// 		req.id = req.session.reqCounter;

		// 	} else {
		// 		//req.id = uuid.v4()
		// 		//req.id = req.session.reqCounter
		// 		req.id = 0;
		// 	}

		// 	next();
		// });

		morgan.token('customStatus', logTokenCustomStatus);
		morgan.token('customMethod', function(req, res) {
			return (req.method + (req.method.length === 3 ? ' ' : '')).gray;
		});
		morgan.token('reqString', function() {
			return 'REQ'.gray
		});
		morgan.token('decodedUrl', function(req, res) {
			return decodeURI(req.url);
		});
		morgan.token('time', function(req, res) {
			// return wrapColor(90, timeNow());
			return timeNow().gray;
		});
		morgan.token('urlWithUser', logTokenUrlWithUser);

		morgan.token('ua', function(req, res) {
			// if (req.url.match('session/init')) {
			return req.headers['user-agent'];
			// }
			// return ' ';
		});

		morgan.token('responseTime', function(req, res) {
			var elapsed = Date.now() - req._startTime;
			var msg = elapsed + 'ms'
			if (elapsed > 5 * 1000) {
				msg += ' SLOW'
				return msg.red;
			}
			return msg.cyan;

		});

		morgan.token('cookies', function(req, res) {
			return req.headers.cookies;
		});

		morgan.token('splitTime', function(req, res) {
			var msg = ''
			msg += (req.sphinxQueryTime ? 'sphinx:' + req.sphinxQueryTime * 1000 + ' ' : '')
			msg += (req.compileDataTime ? 'data:' + req.compileDataTime + ' ' : '')
			msg += (req.facetDataTime ? 'facet:' + req.facetDataTime + ' ' : '')
			return msg.cyan;
		});

		morgan.token('pid', function() {
			return 'pid: ' + process.pid;
		});

		morgan.token('params', logTokenParams);

		function skipFn(req, res) {

			if ((req.query && req.query.noLog) || (req.session && req.session.noLog)) {
				return true;
			}
		}

		// this.app.use(morgan(':reqString :customMethod :time :urlWithUser :ua :params', {
		// 	immediate: true,
		// 	skip: skipFn
		// }));
		this.app.use(morgan(':customStatus :customMethod :time :urlWithUser :ua :responseTime :splitTime :params', {
			immediate: false,
			skip: skipFn
		}));

		return this;
	}

	//----------------------------------------
	// start/stop server
	//----------------------------------------
	Scaff.prototype.start = function(port, cb) {

		var app = this.app;
		var t = this;

		if (!port) {
			throw new Error('port required')
		}

		this.server = app.listen(port, function() {
			debug(
				process.title + " listening on port %d (pid: " + process.pid + ")",
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

	//----------------------------------------
	// middleware
	//----------------------------------------
	Scaff.prototype.authenticated = function(req, res, next) {
		var t = this

		// if (req.session && req.session.passport && req.session.passport.user) {
		if (!req.isAuthenticated()) {
			debug('not authenticated, check apikey');

			// this.passport.authenticate('localapikey', { session: true})(req, res, next);

			this.passport.authenticate('localapikey', function(err, user, info) {
				t.authenticateHandler(err, user, info, req, res, next)
			})(req, res, next);
		} else {
			next()
		}
	}

	Scaff.prototype.errorHandler = function(err, req, res, next) {
		debug('add errorHandler')
		var t = this;
		this.app.use(function(error, req, res, next) {

			if (!t.app.get('dontPrintErrors')) {
				console.error('errorHandler')
				console.error(error.stack);
			}

			// next(err);	
			// if (req.xhr) {
			// 	res.status(500).send({
			// 		error: 'Something blew up!'
			// 	});
			// } else {
			res.status(500).send();
			// }
		})

		return this;
	}

	//----------------------------------------
	// routes
	//----------------------------------------
	Scaff.prototype.logout = function(req, res, next) {

		// to pass unit tests using fakeredis
		req.session.cookie.maxAge = 1001

		// clear passport session
		req.logout();

		res.redirect('/'); //Inside a callback… bulletproof!

		// clear session in store
		// delay session destroy to send cookie with new expiration to client	
		setTimeout(function() {
			req.session.destroy();
		}, 50);

	};

	Scaff.prototype.login = function(req, res, next) {
		var t = this;

		this.passport.authenticate('local', function(err, user, info) {
			debug('local authentication')
			if (!info) {
				info = {};
			}
			info.session = true;
			t.authenticateHandler(err, user, info, req, res, next);
		})(req, res, next);
	}

})(this);