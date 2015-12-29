(function () {
    'use strict';

    var debug = require('debug')('service-scaff:resources');

    var Scaff = module.exports;
    Scaff.mongodb = mongo;
    Scaff.mongo = mongo;

    function mongo(_mongo) {
        if (typeof _mongo === 'undefined') {
            return this._mongo;
        }

        var t = this;
        // janky client object detection
        if (_mongo._events) {
            debug('passed mongo client')
            t.emit('mongo-connected', _mongo)
            t.emit('mongodb-connected', _mongo)
        } else {
            this._mongoConfig = _mongo;

            var MongoClient = require('mongodb').MongoClient;
            var mongoURI = 'mongodb://' + _mongo.host + ':' + _mongo.port +
                '/' + _mongo.db;
            MongoClient.connect(mongoURI, function (err, _db) {
                if (err) {
                    t.emit('mongo-failed', err)
                    t.emit('mongodb-failed', err)
                    return
                    // throw err;
                }
                // _mongo = _db;
                t._mongo = _db;
                t.emit('mongo-connected', _db)
                t.emit('mongodb-connected', _db)
            })


        }

        return this;
    }
})()
