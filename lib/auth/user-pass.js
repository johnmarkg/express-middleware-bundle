(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:auth:user-pass');
    var LocalStrategy = require('passport-local').Strategy;

    Scaff.loginFn = function (u, p, done) {

        if (!this.mysql || !this.mysql()) {
            return done(new Error('mysql requied for login auth'));
        }

        var query =
            "select id, active from users where username = ? and password = ?";
        var params = [u, p];

        this.mysql().query(query, params, function (err, results) {
            if (err) {
                return done(err);
            } else if (!results || results.length === 0) {
                return done(null, false, {
                    message: 'Unknown user'
                });
            } else if (!results[0].active || results[0].active ===
                0) {
                return done(null, false, {
                    message: 'Account is not active'
                });
            } else {
                return done(null, results[0].id);
            }
        });
    }


    Scaff.authenticationLogin = function () {
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

    Scaff.loginSuccess = function(req, res, info) {
		debug('loginSuccess')
		debug(JSON.stringify(req.user));
        debug(JSON.stringify(info))
		// req.user.adminUserView = (info && info.adminUserView);

		res.status(200)
		return res.json({
			success: true
		});
	}

	Scaff.loginFail = function(req, res, info) {

		res.status(401)
		return res.json({
			success: false,
			error: info.message
		});
	}



})()
