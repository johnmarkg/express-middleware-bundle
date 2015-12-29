(function () {
    'use strict';

    var debug = require('debug')('service-scaff:resources');

    var Scaff = module.exports;

    Scaff.redis = function (_redis) {
        if (typeof _redis === 'undefined') {
            return this._redis;
        }

        var client;
        var t = this;

        // janky client object detection
        if (_redis._events) {
            debug('passed redis client');
            client = _redis
            t.emit('redis-connected', client)
        } else {
            debug('passed redis config');
            this._redisConfig = _redis;
            client = require('redis').createClient(_redis.port, _redis.host,
                _redis.options)
            client.once('ready', function () {
                t.emit('redis-connected', client)
            })
        }

        this._redis = client;
        return this;
    }
})()
