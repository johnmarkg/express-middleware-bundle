

var debug = require('debug')('service-scaff:resources:mysql');

(function () {
    'use strict';


    // function factory
    module.exports = function mysql(_label) {

        var client;
        var label = _label || 'default'

        return function mysql(_mysql) {
            if (typeof _mysql === 'undefined') {
                debug('get mysql client: ' + label)
                return client;
            }

            // janky client object detection
            if (_mysql._events) {
                debug('passed mysql client: ' + label)
                client = _mysql
            } else {
                debug('passed mysql config: ' + label)
                client = require('mysql').createPool(_mysql)
            }

            // if bound to object wiht event emmiter, fire event
            if (this && typeof this.emit == 'function') {
                this.emit('mysql-connected', client)
            }

            return this || client;
        }
    }
})()
