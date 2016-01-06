(function () {
    'use strict';

    var debug = require('debug')('service-scaff:auth:user-pass');
    var LocalStrategy = require('passport-local').Strategy;

    exports.loginFn = function (req, u, p, done) {
        var app = req.app;
        if (!app.mysql || !app.mysql()) {
            return done(new Error('mysql requied for login auth'));
        }

        var query =
            "select id, active from users where username = ? and password = ?";
        var params = [u, p];

        app.mysql().query(query, params, function (err, results) {
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

    exports.authenticationLogin = function () {
        debug('authenticationLogin');
        var t = this;
        if (this.addedAuthenticationLogin) {
            debug('already added ')
            return this;
        }
        this.addedAuthenticationLogin = true;

        var local = new LocalStrategy({
            passReqToCallback: true
        }, function(req, u, p, done){
            t.loginFn(req, u, p, done)
        });
        this.passport.use(local);

        return this.initPassport();
    }

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

	exports.loginFail = function(req, res, info) {

		res.status(401)
		return res.json({
			success: false,
			error: info.message
		});
	}
})()
