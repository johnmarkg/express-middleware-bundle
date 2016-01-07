(function () {
    'use strict';

    //----------------------------------------
    // roles
    //----------------------------------------
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

        // // get array intersection
        // // http://stackoverflow.com/questions/1885557/simplest-code-for-array-intersection-in-javascript/1885569#1885569
        // var match = r.filter(function(n) {
        //     return roles.indexOf(n) != -1
        // });
        // if(match.length > 0){
        // 	return true;
        // }
        // return false;

        for (var i in roles) {
            if (r[roles[i]]) {
                return true
            }
        }
        return false;
    }

})()
