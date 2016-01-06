(function () {
    'use strict';

    var debug = require('debug')('service-scaff:sessions');
    var RedisStore = require('connect-redis')(require('express-session'));
    var Passport = require('passport').Passport

    module.exports.addRedisSessions = function (sessionConfig) {
        this.express();


        if (!sessionConfig && this.config('session')) {
            sessionConfig = this.config('session')
        }
        if (!sessionConfig) {
            sessionConfig = {}
        }


        if (!sessionConfig.key) {
            sessionConfig.key = this.sessionCookieLabel
        } else {
            this.sessionCookieLabel = sessionConfig.key
        }


        if (!this.redis || !this.redis()) {
            // throw new Error('redis client required for redis sessions')
            throw new Error('redis config or client required')
        } else {
            redisSessions(this.app, {
                client: this.redis()
            }, sessionConfig, this._cookieConfig)
        }

        return this;

    }


    module.exports.redisSessions = redisSessions
    function redisSessions(app, redisConfig, _sessionConfig, _cookieConfig) {
        debug('redisSessions')

        if (!redisConfig) {
            throw new Error('redis config or client required')
        }

        var sessionConfig = _sessionConfig || {};
        var cookieConfig = _cookieConfig || {};

        // defaults
        var _config = {
            secret: 'do it',
            key: 'sessionId',
            store: new RedisStore(redisConfig),
            cookie: {
                httpOnly: true,
                secure: false,
                maxAge: null //cookie destroyed browser when is closed
            },
            resave: true,
            saveUninitialized: false
        };

        for (var key in sessionConfig) {
            _config[key] = sessionConfig[key]
        }

        for (var key in cookieConfig) {
            _config.cookie[key] = cookieConfig[key]
        }

        var session = require('express-session');

        if (!app.passport) {
            var passport = new Passport();
            app.passport = passport;
            app.use(passport.initialize());
        }

        app.use(passport.session());
        app.use(session(_config));
        return app;
    }

    module.exports.serializeUser = function(user, done) {
		debug('default serializeUser: ' + JSON.stringify(user));
		done(null, user);
	}

    module.exports.deserializeUser = deserializeUserMysql
    module.exports.deserializeUserMysql = deserializeUserMysql
    function deserializeUserMysql(string, done) {
		debug('default deserializeUser: ' + string);

		var q = 'select u.* , GROUP_CONCAT( role ) roles from users u  join user_roles r on(u.id=r.user_id)  where id = ? group by user_id'
		var p = [string]

		this.mysql().query(q, p, function(err, rows) {
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
                    if (!roles[i]) {
                        continue;
                    }
					rows[0].roles[roles[i]] = true;
				}
			}

			delete rows[0].password;
			return done(null, rows[0])
		})
	}

    module.exports.clearUsersOtherSessions = function clearUsersOtherSessions(req, res, next) {
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

    module.exports.clearUsersRememberMe = clearUsersRememberMe
    function clearUsersRememberMe(userId, done) {
        if (!this.redis()) {
            throw new Error('default clearUsersRememberMe requires redis client or config')
        }
        this.redis().del(redisUserRememberMeKey(parseInt(userId, 10)), done);
    }

    module.exports.redisUserSessionsKey = redisUserSessionsKey
    function redisUserSessionsKey(id){
        return 'user_sessions-' + id;
    }
    module.exports.redisUserRememberMeKey = redisUserRememberMeKey
    function redisUserRememberMeKey(id){
        return 'user_remember_me-' + id;
    }
    module.exports.redisRememberMeKey = redisRememberMeKey
    function redisRememberMeKey(id){
        return 'remember_me-' + id;
    }


})()
