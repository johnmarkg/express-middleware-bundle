(function () {
    'use strict';

    var debug = require('debug')('service-scaff:auth');
    var Passport = require('passport').Passport

    //----------------------------------------
    // passport
    //----------------------------------------
    exports.initPassport = function () {
        if (this.passport) {
            return this;
        }
        

        // dont want cached object
		this.passport = new Passport();
        this.passport.deserializeUser(this.deserializeUser.bind(this));
        this.passport.serializeUser(this.serializeUser.bind(this));

        this.app.use(this.passport.initialize());

        // this is strategy that check for cookies
        this.app.use(this.passport.session());

        return this;
    }

    exports.serializeUser = function(user, done) {
		debug('default serializeUser: ' + JSON.stringify(user));
		done(null, user);
	}

    exports.deserializeUser = deserializeUserMysql
    exports.deserializeUserMysql = deserializeUserMysql
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

    //----------------------------------------
    // authentication helpers
    //----------------------------------------
    exports.authenticateHandler = function (err, user, info, req, res, next) {
        var t = this;
        debug('authenticationHandler: ' + user)
        if (err) {
            debug('authenticationHandler: authentication error')
            return next(err);
        }
        if (!user) {
            debug('authenticationHandler: no user')
            return t.authFail(req, res, info);
        }

        // start and save session
        if (info && info.session) {
            req.login(user, {
                session: true
            }, function (err) {

                debug('authenticationHandler: login')
                if (err) {
                    debug('authenticationHandler: login err')
                    // console.error(err)
                    return next(err);
                }

                // save users session ids if they need to be accessed later
                t.redis().sadd(t.redisUserSessionsKey(user),
                    req.sessionID,
                    function (err) {
                        debug(
                            'sadd(redisUserSessionsKey) cb: ' +
                            t.redisUserSessionsKey(user) +
                            ' - ' + req.sessionID)
                        if (err) {
                            return next(err)
                        }
                    })


                if (t.authStrategies.rememberMe && req.body && req.body.remember_me) {

                    debug('authenticationHandler: remember me')
                    t.issueRememberMe(req.user, function (err,
                        token) {
                        if (err) {
                            debug(
                                'authenticationHandler: rememberMe err'
                            )
                            return next(err);
                        }
                        res.cookie(t.rememberMeCookieLabel,
                            token, {
                                path: '/',
                                httpOnly: true,
                                maxAge: 604800000
                            });
                        t.loginSuccess(req, res, user,
                            info);
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
            this.deserializeUser(user.id, function (err, _user) {
                if (err) {
                    return next(err)
                }

                req.user = _user
                next()
            })
        }
    }

    exports.authenticated = function () {

        var t = this;
        this.express()
        this.app.use(function (req, res, next) {

            if (!req.isAuthenticated()) {

                if (t.authStrategies.api) {
                    debug('not authenticated, check apikey');
                    return t.passport.authenticate(
                        'localapikey',
                        function (err, user, info) {
                            t.authenticateHandler(err, user,
                                info, req, res, next)
                        })(req, res, next);
                } else {
                    res.sendStatus(401);
                }
            } else {
                next()
            }
        })
    }



    // exports.authenticated = function(req, res, next) {
    // 	var t = this
    //
    // 	if (!req.isAuthenticated()) {
    // 		debug('not authenticated, check apikey');
    //
    // 		this.passport.authenticate('localapikey', function(err, user, info) {
    // 			t.authenticateHandler(err, user, info, req, res, next)
    // 		})(req, res, next);
    // 	} else {
    // 		next()
    // 	}
    // }


    exports.loginSuccess = function(req, res, info) {
		debug('loginSuccess')
		debug(JSON.stringify(req.user));
        debug(JSON.stringify(info))
		// req.user.adminUserView = (info && info.adminUserView);

		res.status(200)
		return res.json({
			success: true
		});
	}

	exports.authFail = function(req, res, info) {
        debug('authFail')
		res.status(401)
        var json = {
            success: false
        }
        if(info && info.message){
            json.error = info.message
        }
		return res.json(json);
	}


})()
