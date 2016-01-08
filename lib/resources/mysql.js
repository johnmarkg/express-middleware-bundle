
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
                // client.query(query, function(err){
                //     if(err && emit){
                //         client = null
                //         emit('mysql-failed', err)
                //     }
                //
                //     else if (emit) {
                //         emit('mysql-connected', client)
                //     }
                // })
                // if bound to object wiht event emmiter, fire event
                if (this && typeof this.emit == 'function') {
                    this.emit('mysql-connected', client)
                }

            } else {
                debug('passed mysql config: ' + label)

                client = require('mysql').createPool(_mysql)

                client.getConnection(verifyConnection.bind(t, client))

                // client.getConnection(function(err) {
                //     if(err && emit){
                //         client = null
                //         emit('mysql-failed', err)
                //     }
                //
                //     else if (emit) {
                //         emit('mysql-connected', client)
                //     }
                // });
            }



            return this || client;
        }
    }

    function verifyConnection(err, client){
        if(!this){ return }

        // var t = this
        // var emit = t.emit.bind(t)

        if(err && this.emit){
            client = null
            this.emit('mysql-failed', err)
        }

        else if (this.emit) {
            this.emit('mysql-connected', client)
        }


    }
})()
