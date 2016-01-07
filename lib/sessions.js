(function () {
    'use strict';

    var debug = require('debug')('service-scaff:sessions');
    var RedisStore = require('connect-redis')(require('express-session'));
    var Passport = require('passport').Passport

    exports.addRedisSessions = function (sessionConfig) {
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

    exports.redisSessions = redisSessions
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



    exports.clearUsersOtherSessions = function clearUsersOtherSessions(req, res, next) {
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

    exports.clearUsersRememberMe = clearUsersRememberMe
    function clearUsersRememberMe(userId, done) {
        if (!this.redis()) {
            throw new Error('default clearUsersRememberMe requires redis client or config')
        }
        this.redis().del(redisUserRememberMeKey(parseInt(userId, 10)), done);
    }

    exports.redisUserSessionsKey = redisUserSessionsKey
    function redisUserSessionsKey(id){
        return 'user_sessions-' + id;
    }
    exports.redisUserRememberMeKey = redisUserRememberMeKey
    function redisUserRememberMeKey(id){
        return 'user_remember_me-' + id;
    }
    exports.redisRememberMeKey = redisRememberMeKey
    function redisRememberMeKey(id){
        return 'remember_me-' + id;
    }


})()
