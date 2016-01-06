var debug = require('debug')('service-scaff:resources');

(function () {
    'use strict';

    module.exports = function redis(){

        var client = this

        return function(_redis){
            if (typeof _redis === 'undefined') {
                return client
            }

            var t = this

            // janky client object detection
            if (_redis._events) {
                debug('passed redis client');
                client = _redis
                if(t && t.emit){
                    t.emit('redis-connected', client)
                }

            } else {
                debug('passed redis config');
                // this._redisConfig = _redis;
                client = require('redis').createClient(_redis.port, _redis.host,
                    _redis.options)

                if(t && t.emit){
                    client.once('ready', function () {
                        t.emit('redis-connected', client)
                    })
                }


            }

            return this || client;
        }
    }

})()
