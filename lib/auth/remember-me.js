(function () {
    'use strict';

    var debug = require('debug')('service-scaff:auth');
    var RememberMeStrategy = require('passport-remember-me').Strategy;

    exports.verifyRememberMe = function (token, done) {
        debug('verifyRememberMe: ' + token)
        if (!this.redis || !this.redis()) {
            throw new Error(
                'default verifyRememberMe requires redis client');
        }
        var t = this;
        // get user id associated with token
        this.redis().get(
            t.redisRememberMeKey(token),
            function (err, userId) {
                if (err) {
                    return done(err);
                }

                // verify token is still valid
                t.redis().sismember(
                    t.redisUserRememberMeKey(parseInt(userId,
                        10)),
                    token,
                    function (err) {
                        done(err, userId)
                    }
                )
            }
        );
    }

    exports.issueRememberMe = function (userId, done) {
        debug('issueRememberMe: ' + userId)
        var t = this;

        userId = parseInt(userId, 10)
        if (isNaN(userId) || userId < 1) {
            return done('invalid userId');
        }

        if (!this.redis()) {
            throw new Error(
                'default verifyRememberMe requires redis client or config'
            )
        }
        var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
            /[xy]/g,
            function (c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

        // var key = 'remember_me-' + guid;
        // var userKey = 'remember_me-' + userId
        var expires = (1000 * 60 * 60 * 24 * 30) // 30 days
        this.redis().setex(
            t.redisRememberMeKey(guid),
            expires,
            userId,
            function (err) {
                if (err) {
                    return done(err)
                }
                t.redis().sadd(t.redisUserRememberMeKey(userId),
                    guid,
                    function (err) {
                        if (err) {
                            return done(err)
                        }
                        done(null, guid);
                    })
            }
        );
    }

    exports.authenticationRememberMe = function () {
        debug('authenticationRememberMe');

        var t = this;

        if(this.authStrategies.rememberMe){
            debug('already added ')
            return this;
        }
        this.authStrategies.rememberMe = true

        this.addCookieParser();
        this.initPassport();

        var strategy =  new RememberMeStrategy({
                key: t.rememberMeCookieLabel
            },
            // this.verifyRememberMe.bind(this),
            function(token, done){
                t.verifyRememberMe(token, done)
            },
            // this.issueRememberMe.bind(this)
            function(userId, done){
                t.issueRememberMe(userId, done)
            }
        )

        this.passport.use(strategy);

        // flag for authenticationHandler, send cookie to client
        // this.rememberMe = true;

        // this.app.use(this.passport.authenticate('remember-me'));

        return this;
    }

})()
