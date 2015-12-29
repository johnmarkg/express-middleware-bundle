(function () {
    'use strict';

    var debug = require('debug')('service-scaff:status');

    var Scaff = module.exports;

    //----------------------------------------
    // status functions
    //----------------------------------------
    function haveRedisClient(_this, cb) {
        if (!_this.redis || !_this.redis()) {
            var err = new Error('no redis client set')
            if (typeof cb === 'function') {
                cb(err)
                return false;
            } else {
                throw err
            }

        }
        return true;
    }

    Scaff.setStatus = function (key, field, val, cb) {
        debug('setStatus ' + key + ', ' + field + ': ' + val)
        if (!haveRedisClient(this, cb)) {
            return;
        }
        this.redis().hset(key, field, val, cb)
    }
    Scaff.getStatusAll = function (key, cb) {
        debug('getStatusAll ' + key)

        if (!haveRedisClient(this, cb)) {
            return;
        }

        this.redis().hgetall(key, cb)

    }
    Scaff.getStatus = function (key, field, cb) {
            if (!haveRedisClient(this, cb)) {
                return;
            }
            this.redis().hget(key, field, cb)
        }
        // Scaff.prototype.delStatusAll = function(key,cb){
        //     if(!haveRedisClient(this,cb)){
        //     	return;
        //     }
        //     this.redis().del(key,cb)
        // }
    Scaff.incrementStatus = function (key, field, val, cb) {
        debug('incrementStatus ' + key + ', ' + field + ': ' + val)
        if (!haveRedisClient(this, cb)) {
            return;
        }
        this.redis().hincrby(key, field, val, cb)
    }

})()
