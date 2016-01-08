
var debug = require('debug')('service-scaff:resources:mysql');

(function () {
    'use strict';

    // function factory
    module.exports = function mysql(_label) {

        var client;
        var label = _label || 'default'
        // var query = 'select 1'

        return function mysql(_mysql) {
            if (typeof _mysql === 'undefined') {
                debug('get mysql client: ' + label)
                return client;
            }

            var t = this || {}

            // janky client object detection
            if (_mysql._events) {
                debug('passed mysql client: ' + label)
                client = _mysql


                // client.query(query, verifyConnection.bind(t, client))
                if (this && typeof this.emit == 'function') {
                    this.emit('mysql-connected', client)
                }

            } else {
                debug('passed mysql config: ' + label)

                client = require('mysql').createPool(_mysql)

                client.getConnection(verifyConnection)
            }

            function verifyConnection(err){
                // if(!this){ return }
                // console.info(arguments)
                if(err && t.emit){
                    client = null
                    t.emit('mysql-failed', err)
                }

                /* istanbul ignore next */
                else if (t.emit) {
                    t.emit('mysql-connected', client)
                }

            }


            return this || client;
        }
    }


})()
