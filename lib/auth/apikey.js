(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:auth:apikey');
    var LocalAPIKeyStrategy = require('passport-localapikey').Strategy;

    Scaff.apiAuth = function (req, key, done) {
        if (!this.mysql || !this.mysql()) {
            return done(new Error('mysql client required for api auth'))
        }
// console.info('have mysql client')
// console.info(this.mysql())
        var q =
            "select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?";

        this.mysql().query(q, [key], function (err, results) {

            if (err) {
                return done(null, false, {
                    message: 'ERROR Authenticating'
                });
            } else if (!results || results.length === 0) {
                return done(null, false, {
                    message: 'Unknown user'
                });
            } else if (results && results[0] && results[0].active ===
                0) {
                return done(null, false, {
                    message: 'Account is not active'
                });
            }

            done(null, {
                id: results[0].id
            });
        });
    }

    Scaff.authenticationApikey = function () {
        debug('authenticationApikey');
        var t = this;

        this.passport.use(new LocalAPIKeyStrategy({
            passReqToCallback: true
        }, t.apiAuth.bind(this)));

        return this.initPassport();
    }

})()
