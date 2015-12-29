(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:sessions');
    var RedisStore = require('connect-redis')(require('express-session'));
    var Passport = require('passport').Passport

    Scaff.addRedisSessions = function (sessionConfig) {
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


    Scaff.redisSessions = redisSessions;

    function redisSessions(app, redisConfig, _sessionConfig, _cookieConfig) {
        debug('redisSessions')

        if (!redisConfig) {
            throw new Error('redis config or client required')
        }

        debug(JSON.stringify(redisConfig))
            // console.info(redisConfig)

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

        // return this;
        // return session(_config)
    }

    exports.serializeUser = function serializeUser(user, done) {
        debug('default serializeUser: ' + JSON.stringify(user));
        done(null, user);
    }

    exports.deserializeUserMysql = function deserializeUserMysql(
        mysqlClient) {
        return function _deserializeUser(string, done) {
            debug('default deserializeUser: ' + string);

            var q =
                'select u.* , GROUP_CONCAT( role ) roles from users u join user_roles r on(u.id=r.user_id)  where id = ? group by user_id'
            var p = [string]

            mysqlClient.query(q, p, function (err, rows) {
                debug('deserializeUser query cb')
                if (err) {
                    return done(err)
                }

                if (rows[0].roles) {

                    var roles = rows[0].roles.split(',');
                    debug(rows[0].id + ' roles: ' + roles)
                    rows[0].roles = {};

                    for (var i in roles) {
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

    }

    // function clearUsersOtherSessions(req, res, next) {
    //     // var userKey = 'remember_me-' + parseInt(userId, 10)
    //     if (!this.redis()) {
    //         throw new Error('default clearUsersRememberMe requires redis client or config')
    //     }
    //
    //     var t = this;
    //     this.redis().smembers(
    //         redisUserSessionsKey(req.user.id),
    //         function(err, members){
    //             if(err){ return next(err); }
    //             debug('clearUsersOtherSessions: ' + JSON.stringify(members));
    //
    //             var delKeys = [];
    //             for(var i in members){
    //                 debug(members[i])
    //                 if(members[i] === req.sessionId){
    //                     debug('this is the current session, dont delete');
    //                     // return qNext();
    //                 }
    //                 else{
    //                     delKeys.push('sess:' + members[i])
    //                 }
    //             }
    //
    //             if(delKeys.length === 0){
    //                 return next();
    //             }
    //
    //             var args = delKeys
    //             args.push(function(err){
    //                 console.info(arguments)
    //                 if(err){
    //                     return next(err);
    //                 }
    //                 next()
    //             });
    //
    //             t.redis().del.apply(t.redis(), args);
    //         }
    //     );
    // }
    //
    // function clearUsersRememberMe(userId, done) {
    //     // var userKey = 'remember_me-' + parseInt(userId, 10)
    //     if (!this.redis()) {
    //         throw new Error('default clearUsersRememberMe requires redis client or config')
    //     }
    //     this.redis().del(redisUserRememberMeKey(parseInt(userId, 10)), done);
    // }
    //
    // function redisUserSessionsKey(id){
    //     return 'user_sessions-' + id;
    // }
    // function redisUserRememberMeKey(id){
    //     return 'user_remember_me-' + id;
    // }
    // function redisRememberMeKey(id){
    //     return 'remember_me-' + id;
    // }
    //
    // //----------------------------------------
    // // passport
    // //----------------------------------------
    // function serializeUser(user, done) {
    //     debug('default serializeUser: ' + JSON.stringify(user));
    //     done(null, user);
    // }
    //
    // function deserializeUser(string, done) {
    //     debug('default deserializeUser: ' + string);
    //
    //     var q = 'select u.* , GROUP_CONCAT( role ) roles from users u  join user_roles r on(u.id=r.user_id)  where id = ? group by user_id'
    //     var p = [string]
    //     this._mysql.query(q, p, function(err, rows) {
    //         debug('deserializeUser query cb')
    //         if (err) {
    //             return done(err)
    //         }
    //         // debug(rows[0].roles)
    //         if(rows[0].roles){
    //
    //             var roles = rows[0].roles.split(',');
    //             debug(rows[0].id + ' roles: ' + roles)
    //             rows[0].roles = {};
    //
    //             for(var i in roles){
    //                 rows[0].roles[roles[i]] = true;
    //             }
    //         }
    //
    //         delete rows[0].password;
    //         return done(null, rows[0])
    //     })
    // }
    //
    // function initPassport() {
    //     this.passport.deserializeUser(this.deserializeUser.bind(this));
    //     this.passport.serializeUser(this.serializeUser.bind(this));
    //
    //     if (this.passportInitialized) {
    //         return this;
    //     }
    //     this.passportInitialized = true;
    //
    //     this.app.use(this.passport.initialize());
    //
    //     // this is strategy that check for cookies
    //     this.app.use(this.passport.session());
    //
    //     return this;
    // }

})()
