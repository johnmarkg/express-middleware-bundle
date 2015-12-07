(function() {

	var util = require('util');
    var events = require('events');

	var fs = require('fs');
	var debug = require('debug')('service-scaff')

	var express = require('express');
	// var Q = require('q');

	// var redis = require('redis');
	var RedisStore = require('connect-redis')(require('express-session'));

	var Passport = require('passport').Passport
	var LocalStrategy = require('passport-local').Strategy;
	var LocalAPIKeyStrategy = require('passport-localapikey').Strategy;
	var RememberMeStrategy = require('passport-remember-me').Strategy;

	var morganTokens = require('./lib/morgan-tokens')

	var rabbit = require('./lib/rabbit')

	function Scaff() {

		events.EventEmitter.call(this)

		this.rememberMeCookieLabel = 'rememberMe'
		this.sessionCookieLabel = 'sessionId'

		this.debug = debug;

		return this;
	}

	util.inherits(Scaff, events)

	// export constructor
	exports = module.exports = new Scaff();

	// use this to get a new, non cached object
	Scaff.prototype.ServiceScaff = function() {
		return new Scaff();
	};

	Scaff.prototype.serviceScaff = function() {
		return new Scaff();
	};


	Scaff.prototype.express = function() {

		// dont want cached object
		this.passport = new Passport();

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

	Scaff.prototype.register = function(label, checkPath, aliases){
		if(!this.config('register')){
			console.info('skipping registration, no config found')
			return this;
		}
		this._register = label;
		this._registerCheckPath = checkPath
		this._registerAliases = aliases

		return this;
	}

	Scaff.prototype.connectToResources = function(resources) {
		if(typeof resources == 'string'){
			resources = [resources]
		}
		var t = this;
		// var promises = []

		var connected = 0;
		var failed = 0;
		var count = resources.length

		var time = 1000 * 30
		var timer = setTimeout(function(){
			t.emit('resources-failed', 'timeout: ' + time)
		}, time)

		resources.forEach(function(r){
			debug('connectToResources: ' + r)



			t.once(r + '-connected', function(){
				debug('connectToResources, connected: ' + r)
				connected++;
				if(connected == count){
					clearTimeout(timer)
					t.emit('resources-connected')
				}
			})
			t.once(r + '-failed', function(){
				debug('connectToResources, failed: ' + r)
				failed++;
				clearTimeout(timer)
				t.emit('resources-failed', r)
			})

			t[r].call(t, t.config(r))
		})


		return this;
	}

	//----------------------------------------
	// setters/getters
	//----------------------------------------
	Scaff.prototype.redis = function(_redis) {
		if(typeof _redis === 'undefined'){
			return this._redis;
		}


		var client;
		var t = this;

		// janky client object detection
		if(_redis._events){
			debug('passed redis client');
			client = _redis
			t.emit('redis-connected', client)
		}
		else{
			debug('passed redis config');
			this._redisConfig = _redis;
			client = require('redis').createClient(_redis.port, _redis.host, _redis.options)
			client.once('ready', function(){
				t.emit('redis-connected', client)
			})
		}

		this._redis = client;
		return this;
	}
	Scaff.prototype.mongodb = function(_mongo){
 		return this.mongo(_mongo)
	}
    Scaff.prototype.mongo = function(_mongo) {
		if(typeof _mongo === 'undefined'){
			return this._mongo;
		}

		var t = this;
		// janky client object detection
		if(_mongo._events){
			debug('passed mongo client')
			t.emit('mongo-connected', _mongo)
			t.emit('mongodb-connected', _mongo)
		}
		else{
			 this._mongoConfig = _mongo;

			var MongoClient = require('mongodb').MongoClient;
			var mongoURI = 'mongodb://' + _mongo.host + ':' + _mongo.port + '/' + _mongo.db;
			MongoClient.connect(mongoURI, function (err, _db) {
				if(err){
					t.emit('mongo-failed', err)
					t.emit('mongodb-failed', err)
					return
					// throw err;
				}
				// _mongo = _db;
				t._mongo = _db;
				t.emit('mongo-connected', _db)
				t.emit('mongodb-connected', _db)
			})


		}

        return this;
    }

	Scaff.prototype.sphinxql = function(_sphinxql) {
		if(typeof _sphinxql === 'undefined'){
			return this._sphinxql;
		}

		var t = this
		// janky client object detection
		if(_sphinxql._events){
			debug('passed sphinxql client')
			t.emit('sphinxql-connected', _sphinxql)
		}
		else{
			 this._sphinxqlConfig = _sphinxql;
			_sphinxql = require('mysql').createPool(_sphinxql)
			t.emit('sphinxql-connected', _sphinxql)
		}
		this._sphinxql = _sphinxql;
		return this;
	}

	Scaff.prototype.mysql = function(_mysql) {
		if(typeof _mysql === 'undefined'){
			return this._mysql;
		}

		var t = this

		// janky client object detection
		if(_mysql._events){
			debug('passed mysql client')
			this._mysql = _mysql;
			t.emit('mysql-connected', this._mysql)
		}
		else{
			this._mysqlConfig = _mysql;
			this._mysql = require('mysql').createPool(_mysql)
			t.emit('mysql-connected', this._mysql)
		}


		return this;
	}

	Scaff.prototype.config = function(key,_config) {

		if(typeof key == 'object'){
			this._config = key;
			return this;
		}

		if(!this._config){
			this._config = {}
		}
		if(typeof _config === 'undefined'){
			return this._config[key]
		}
		this._config[key] = _config
		return this;
	}

	Scaff.prototype.cookieConfig = function(_config) {
		this._cookieConfig = _config;
		return this;
	}

	//----------------------------------------
	// rabbit
	//----------------------------------------
	Scaff.prototype.rabbit = function(wascallyConfig, cb) {
		if(typeof wascallyConfig === 'undefined'){
			return this.wascally;
		}

		var config = {};

		if(!wascallyConfig.connection){
			config.connection = wascallyConfig
		}
		else{
			config = wascallyConfig
		}

		this._rabbitConfig = config;
	    this.wascally = require( 'wascally' );
		var t = this;

	    this.wascally.configure(config).done(function(){

	    	if(typeof cb === 'function'){
	    		cb();
	    	}
			t.emit('rabbit-connected', t.wascally)

	    });

		return this;
	}
	Scaff.prototype.rabbitReceive = function(queue, limit, handler){
		return rabbit.receive.call(this, queue, limit, handler)
	}
	Scaff.prototype.rabbitRespond = function(queue, limit, handler){
		return rabbit.respond.call(this, queue, limit, handler)
	}
	Scaff.prototype.rabbitSend = function(label, msg, cb){
		return rabbit.send.call(this, label, msg, cb)
	}
	Scaff.prototype.rabbitRequest = function(label, msg, cb){
		return rabbit.request.call(this, label, msg, cb)
	}
	Scaff.prototype.rabbitReplyQueue = function(label){
		if(this.config.rabbit){
			this.config.rabbit.replyQueue = rabbit.replyQueue(label)
		}
		return this;
	}

	//----------------------------------------
	// helpers
	//----------------------------------------
	Scaff.prototype.web = function() {

		this
			.express()
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser();

		// if (this._redis) {
			this
				.addRedisSessions()
				.authenticationRememberMe()
		// }

		// if (this._mysql) {
			this
				.authenticationApikey()
				.authenticationLogin()
		// }

		return this;
	}

	Scaff.prototype.api = function() {
		this
			.express()
			.addCookieParser()
			.addGzip()
			.addQueryAndBodyParser();

		// if (this._redis) {
			this
				.addRedisSessions()
				// .authenticationRememberMe()
		// }

		// if (this._mysql) {
			this
				.authenticationApikey()
				// .authenticationLogin()
		// }

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
	// status functions
	//----------------------------------------
	function haveRedisClient(_this, cb){
        if(!_this.redis()){
        	var err = new Error('no redis client set')
        	if(typeof cb === 'function'){
				cb(err)
				return false;
        	}
        	else{
	        	throw err
	        }

        }
        return true;
	}

	Scaff.prototype.setStatus = function(key,field,val,cb){
        debug('setStatus ' + key  + ', ' + field +': ' +val)
        if(!haveRedisClient(this,cb)){
        	return;
        }
		this.redis().hset(key,field,val,cb)
	}
	Scaff.prototype.getStatusAll = function(key,cb){
        debug('getStatusAll ' + key )

        if(!haveRedisClient(this,cb)){
        	return;
        }

		this.redis().hgetall(key,cb)

	}
	Scaff.prototype.getStatus = function(key,field,cb){
        if(!haveRedisClient(this,cb)){
        	return;
        }
        this.redis().hget(key,field,cb)
	}
    // Scaff.prototype.delStatusAll = function(key,cb){
    //     if(!haveRedisClient(this,cb)){
    //     	return;
    //     }
    //     this.redis().del(key,cb)
    // }
	Scaff.prototype.incrementStatus = function(key,field,val,cb){
        debug('incrementStatus ' + key  + ', ' + field +': ' +val)
        if(!haveRedisClient(this,cb)){
        	return;
        }
        this.redis().hincrby(key,field,val,cb)
	}

	//----------------------------------------
	// basic middleware
	//----------------------------------------
	Scaff.prototype.addQueryAndBodyParser = function() {
		debug('addQueryAndBodyParser')
		var bodyParser = require('body-parser');

		var config = {
			extended: true
		}
		if(this.maxBodySize){
			config.limit = '2mb'
		}

		this.app.use(bodyParser.json(config));
		this.app.use(bodyParser.urlencoded(config));

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
	Scaff.prototype.addRedisSessions = function(redisConfig, _sessionConfig, _cookieConfig) {
		debug('addRedisSessions')

		if(typeof redisConfig === 'undefined'){
			if(!this._redis){
				throw new Error('redis config or client required')
			}
			redisConfig = {
				client: this._redis
			}
		}

		var sessionConfig = _sessionConfig || {};
		var cookieConfig = _cookieConfig || this._cookieConfig || {};

		this.addCookieParser();
		this.addQueryAndBodyParser();

		// defaults
		var _config = {
			secret: 'do it',
			key: this.sessionCookieLabel,
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

	Scaff.prototype.clearUsersOtherSessions = function(req, res, next) {
		// var userKey = 'remember_me-' + parseInt(userId, 10)
		if (!this.redis()) {
			throw new Error('default clearUsersRememberMe requires redis client or config')
		}

		var t = this;
		this.redis().smembers(
			redisUserSessionsKey(req.user.id),
			function(err, members){
				if(err){ return next(err); }
				debug('clearUsersOtherSessions: ' + JSON.stringify(members));

				var delKeys = [];
				for(var i in members){
					debug(members[i])
					if(members[i] === req.sessionId){
						debug('this is the current session, dont delete');
						// return qNext();
					}
					else{
						delKeys.push('sess:' + members[i])
					}
				}

				if(delKeys.length === 0){
					return next();
				}

				var args = delKeys
				args.push(function(err){
					console.info(arguments)
					if(err){
						return next(err);
					}
					next()
				});

				t.redis().del.apply(t.redis(), args);
			}
		);
	}

	Scaff.prototype.clearUsersRememberMe = function(userId, done) {
		// var userKey = 'remember_me-' + parseInt(userId, 10)
		if (!this.redis()) {
			throw new Error('default clearUsersRememberMe requires redis client or config')
		}
		this.redis().del(redisUserRememberMeKey(parseInt(userId, 10)), done);
	}

	function redisUserSessionsKey(id){
		return 'user_sessions-' + id;
	}
	function redisUserRememberMeKey(id){
		return 'user_remember_me-' + id;
	}
	function redisRememberMeKey(id){
		return 'remember_me-' + id;
	}

	//----------------------------------------
	// passport
	//----------------------------------------
	Scaff.prototype.serializeUser = function(user, done) {
		debug('default serializeUser: ' + JSON.stringify(user));
		done(null, user);
	}

	Scaff.prototype.deserializeUser = function(string, done) {
		debug('default deserializeUser: ' + string);

		var q = 'select u.* , GROUP_CONCAT( role ) roles from users u  join user_roles r on(u.id=r.user_id)  where id = ? group by user_id'
		var p = [string]
		this._mysql.query(q, p, function(err, rows) {
			debug('deserializeUser query cb')
			if (err) {
				return done(err)
			}
			// debug(rows[0].roles)
			if(rows[0].roles){

				var roles = rows[0].roles.split(',');
				debug(rows[0].id + ' roles: ' + roles)
				rows[0].roles = {};

				for(var i in roles){
					rows[0].roles[roles[i]] = true;
				}
			}

			delete rows[0].password;
			return done(null, rows[0])
		})
	}

	Scaff.prototype.initPassport = function() {
		this.passport.deserializeUser(this.deserializeUser.bind(this));
		this.passport.serializeUser(this.serializeUser.bind(this));

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

		var query = "select id, active from users where username = ? and password = ?";
		var params = [u, p];

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
			else{
				return done(null, results[0].id);
			}
		});
	}


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
		if (!this.redis()) {
			throw new Error('default verifyRememberMe requires redis client');
		}
		var t = this;
		// get user id associated with token
		this.redis().get(
			redisRememberMeKey(token),
			function(err, userId){
				if(err){ return done(err); }

				// verify token is still valid
				t.redis().sismember(
					redisUserRememberMeKey(parseInt(userId, 10)),
					token,
					function(err){
						done(err, userId)
					}
				)
			}
		);
	}

	Scaff.prototype.issueRememberMe = function(userId, done) {
		debug('issueRememberMe: ' + userId)
		var t = this;

		userId = parseInt(userId, 10)
		if(isNaN(userId) || userId < 1){
			return done('invalid userId');
		}

		if (!this.redis()) {
			throw new Error('default verifyRememberMe requires redis client or config')
		}
		var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0,
				v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

		// var key = 'remember_me-' + guid;
		// var userKey = 'remember_me-' + userId
		var expires = (1000 * 60 * 60 * 24 * 30) // 30 days
		this.redis().setex(
			redisRememberMeKey(guid),
			expires,
			userId,
			function(err) {
				if(err){
					return done(err)
				}
				t.redis().sadd(redisUserRememberMeKey(userId), guid, function(err){
					if(err){
						return done(err)
					}
					done(null, guid);
				})
			}
		);
	}

	Scaff.prototype.authenticationRememberMe = function() {
		debug('authenticationRememberMe');

		// if(typeof verify === 'function'){ this.verifyRememberMe = verify }
		// if(typeof issue === 'function'){ this.issueRememberMe = issue }
		var t = this;
		this.addCookieParser();

		this.passport.use(
			new RememberMeStrategy({
					key: t.rememberMeCookieLabel
				},
				this.verifyRememberMe.bind(this),
				this.issueRememberMe.bind(this)
			)
		);

		this.initPassport();
		// flag for authenticationHandler, send cookie to client
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

	Scaff.prototype.authenticationApikey = function() {
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
		debug('authenticationHandler: ' + user)
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

				// save users session ids if they need to be accessed later
				t.redis().sadd(redisUserSessionsKey(user), req.sessionID, function(err){
					debug('sadd(redisUserSessionsKey cb')
					if(err){
						return next(err)
					}
				})


				if (t.rememberMe && req.body && req.body.remember_me) {

					debug('authenticationHandler: remember me')
					t.issueRememberMe(req.user, function(err, token) {
						if (err) {
							debug('authenticationHandler: rememberMe err')
							return next(err);
						}
						res.cookie(t.rememberMeCookieLabel, token, {
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
	// roles
	//----------------------------------------
	Scaff.prototype.checkRoles = function(roles, req, res, next) {

		if(roleTest(roles, req)){
			return next();
		}

		res.status(403);
		return res.end('insufficient premissions');
	}
	Scaff.prototype.checkRolesWrapper = function(roles, fn, req, res, next) {

		if(roleTest(roles, req)){
			return fn(req, res, next)
		}

		return next();
	}

	function roleTest(roles, req){
		var r = req.user && req.user.roles  ? req.user.roles : {};

		// // get array intersection
		// // http://stackoverflow.com/questions/1885557/simplest-code-for-array-intersection-in-javascript/1885569#1885569
		// var match = r.filter(function(n) {
		//     return roles.indexOf(n) != -1
		// });
		// if(match.length > 0){
		// 	return true;
		// }
		// return false;

		for(var i in roles){
			if(r[roles[i]]){
				return true
			}
		}
		return false;
	}


	//----------------------------------------
	// logging
	//----------------------------------------
	Scaff.prototype.addLogger = function(tokens, immediate) {
		if(!this.morgan){
			this.morgan = require('morgan');
			morganTokens.addTokens(this.morgan);
		}

		function skipFn(req) {
			if (req.noLog || (req.query && req.query.noLog)) {
				return true;
			}
		}

		if(!tokens){
			tokens = ':time :customMethod :customStatus :urlWithUser :responseTime :params :customUa'
		}

		var morganFn = this.morgan(tokens, {
			immediate: immediate,
			skip: skipFn
		});

		this.app.use(morganFn);

		var manualLogger = this.morgan(tokens, {
			immediate: true
		});

		this.log = function(req, res){

			if(typeof req === 'string'){
				req = {
					url: req,
					method: 'LOG'
				}
			}

			if(skipFn(req)){ return this; }

			manualLogger(req, res || {}, function(){})
			return this;
		}
		this.app.log = this.log.bind(this);

		return this;
	}


	//----------------------------------------
	// start/stop server
	//----------------------------------------
	Scaff.prototype.start = function(port, cb) {

		var app = this.app;
		var t = this;

		if (typeof port == 'undefined') {
			throw new Error('port required')
		}


		if(t._register){
			var host = t.config('register').routers[0].host
			var port = t.config('register').routers[0].port

			var seaport = require('seaport');
			var ports = seaport.connect({
				host: host || 'localhost',
				port: 59001,
			});

			var _port = app.listen(
				ports.register(t._register, { aliases: t._registerAliases } ),

				function(err){
					up(err, _port.address().port)
				}
			);
		}
		else{

			app.listen(port, function(err) {
				t.server = this;
				debug(
					process.title + " listening on port %d (pid: " + process.pid + ")",
					this.address().port
				);

				up(err, this.address().port)
			});
		}

		function up(err, _port){

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

	//----------------------------------------
	// middleware
	//----------------------------------------
	Scaff.prototype.authenticated = function(req, res, next) {
		var t = this

		if (!req.isAuthenticated()) {
			debug('not authenticated, check apikey');

			this.passport.authenticate('localapikey', function(err, user, info) {
				t.authenticateHandler(err, user, info, req, res, next)
			})(req, res, next);
		} else {
			next()
		}
	}


	Scaff.prototype.sendEmail = function(msg, subject, html, to, from, cb) {

		if(!this.config('email')){
			if(typeof cb == 'function'){
				cb(new Error('email config is required: serviceScaff.config("email", configObject)'))
			}
			return
		}
		var email = require('./lib/email');
		email.send(this.config('email'), msg, subject, html, to, from, cb);
	}

	function uncaught(label, error){
		var os = require("os");
		var msg = 'Error: ' + error.stack.split("\n").join("\n") + "\n\n";
		msg += 'Host: ' + os.hostname();
		var subject = 'PatentCAM ' + label + ': ' + __filename;
		this.sendEmail(msg, subject, function(){
			throw error
		})
	}
	Scaff.prototype.errorHandler = function() {

		debug('add errorHandler')
		var t = this;

		if(t.config('email')){
			process.on('uncaughtException', uncaught.bind(t, 'uncaughtException') )
			process.on('unhandledRejection', uncaught.bind(t, 'unhandledRejection') )
		}

		this.app.use(function(error, req, res, next) {

			if (!t.app.get('dontPrintErrors')) {
				console.error(error.stack);
			}

			res.status(500).send(error.toString());

			if(t.config('email')){

				var msg = ''//'<html><body>'

				msg += 'Path: ' + req.path + "\n\n";
				msg += 'Query: ' + JSON.stringify(req.query, null, 4) + "\n\n";
				msg += 'Body: ' + JSON.stringify(req.body, null, 4) + "\n\n";
				msg += 'Url: ' + req.url + "\n\n";
				msg += "-------------------------------\n\n"
				msg += 'Error: ' + error.stack.split("\n").join("\n") + "\n\n";
				msg += "-------------------------------\n\n"
				msg += 'User: ' + JSON.stringify(req.user, null, 4) + "\n\n";
				// msg += '<p>Request: ' + req.url + '</p>';
				// msg += '<p>Query: ' + JSON.stringify(req.query, null, 4) + '</p>';
				// msg += '<p>Error: ' + JSON.stringify(error.stack, null, 4) + '</p>';
				// msg += '<p>User: ' + JSON.stringify(req.user, null, 4) + '</p>';
				// msg += '</body></html>'

				var email = require('./lib/email');
				email.send(
					t.config('email'),
					msg,
					'PatentCAM Error: ' + req.protocol + '://' + req.get('host') + req.path,
					next
				)
			}
			else if(typeof next === 'function'){
				next()
			}

		});

		return this;
	}

	//----------------------------------------
	// routes
	//----------------------------------------
	Scaff.prototype.logout = function(req, res) {

		// clear passport session
		req.logout();

		// clear session in store
		req.session.destroy();

		// reset client cookies
		res.cookie(this.sessionCookieLabel, '');
		res.cookie(this.rememberMeCookieLabel, '');

		res.redirect('/');
	};

	Scaff.prototype.login = function(req, res, next) {
		var t = this;

		this.passport.authenticate('local', function(err, user, info) {
			debug('local authenticate cb: ' + user)
			debug(JSON.stringify(info))
			if (!info) {
				info = {};
			}
			info.session = true;
			t.authenticateHandler(err, user, info, req, res, next);
		})(req, res, next);
	}


	Scaff.prototype.commandLineArgs = function(options, ver){
		return require('./lib/command-line')(options, ver)

		// console.info(fn)
		// return fn
	}




})(this);
