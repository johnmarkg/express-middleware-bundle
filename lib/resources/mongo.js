var debug = require('debug')('service-scaff:resources:mongo');

(function () {
    'use strict';

    // function factory
    module.exports = function mongo(_label) {

        var client;
        var label = _label || 'default'


        return function mongo(_mongo) {

            var t = this;

            if (typeof _mongo === 'undefined') {
                debug('get mongo client: ' + label)
                return client;
            }

            // janky client object detection
            if (_mongo._events) {
                debug('passed mongo client: ' + label)
                client = _mongo
            } else {
                debug('passed mongo config: ' + label)

                var MongoClient = require('mongodb').MongoClient;
                var mongoURI = 'mongodb://' + _mongo.host + ':' + _mongo.port +
                    '/' + _mongo.db;

                MongoClient.connect(mongoURI, function (err, _db) {
                    if (err) {
                        if(t && t.emit){
                            t.emit('mongo-failed', err)
                            t.emit('mongodb-failed', err)
                        }

                        return
                    }

                    client = _db
                    if(t && t.emit){
                        t.emit('mongo-connected', _db)
                        t.emit('mongodb-connected', _db)
                    }

                })

            }

            return this || client;
        }
    }

})()
