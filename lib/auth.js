(function () {
    'use strict';

    var debug = require('debug')('service-scaff:auth');

	//----------------------------------------
	// authentication helpers
	//----------------------------------------
	exports.authenticateHandler = function(err, user, info, req, res, next) {
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
                    console.error(err)
					return next(err);
				}

				// save users session ids if they need to be accessed later
				t.redis().sadd(t.redisUserSessionsKey(user), req.sessionID, function(err){
					debug('sadd(redisUserSessionsKey) cb: ' + t.redisUserSessionsKey(user) + ' - ' + req.sessionID)
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

    exports.authenticated = function() {

        var t = this;
        this.express()
        this.app.use(function(req, res, next){

            if (!req.isAuthenticated()) {
                if(t.localApiAuth){
                    debug('not authenticated, check apikey');
        			return t.passport.authenticate('localapikey', function(err, user, info) {
        				t.authenticateHandler(err, user, info, req, res, next)
        			})(req, res, next);
                }
                else{
                    res.sendStatus(401);
                }
    		}  else {
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

})()
