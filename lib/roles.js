(function () {
    'use strict';

    exports.checkRoles = function (roles) {
        return function(req, res, next){
            if (roleTest(roles, req)) {
                return next();
            }

            res.status(403);
            return res.end('insufficient premissions');
        }
    }
    exports.checkRolesWrapper = function (roles, fn) {
        return function(req, res, next){
            if (roleTest(roles, req)) {
                return fn(req, res, next)
            }

            return next();
        }
    }

    function roleTest(roles, req) {
        var r = req.user && req.user.roles ? req.user.roles : {};

        for (var i in roles) {
            if (r[roles[i]]) {
                return true
            }
        }
        return false;
    }

})()
