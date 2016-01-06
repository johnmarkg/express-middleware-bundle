var debug = require('debug')('service-scaff:resources:rabbit');

(function () {
    'use strict';

    module.exports = function rabbit(){
        var client;


        return function(wascallyConfig, cb){
            debug('rabbit')

            var t = this;

            if (typeof wascallyConfig === 'undefined') {
                return client;
            }

            var config = {};
            if (!wascallyConfig.connection) {
                config.connection = wascallyConfig
            } else {
                config = wascallyConfig
            }

            if(t){
                t._rabbitConfig = config;    
            }

            client = require('wascally');
            client.configure(config).done(function () {

                if (typeof cb === 'function') {
                    cb();
                }

                // if bound to object wiht event emmiter, fire event
                if (t && typeof t.emit == 'function') {
                    t.emit('rabbit-connected', client)
                }

            });

            return this || client;
        }
    }


    // var Scaff = module.exports;
    // Scaff.rabbit = function (wascallyConfig, cb) {
    //     debug('rabbit')
    //     if (typeof wascallyConfig === 'undefined') {
    //         return this.wascally;
    //     }
    //
    //     var config = {};
    //
    //     if (!wascallyConfig.connection) {
    //         config.connection = wascallyConfig
    //     } else {
    //         config = wascallyConfig
    //     }
    //
    //     this._rabbitConfig = config;
    //     this.wascally = require('wascally');
    //     var t = this;
    //
    //     this.wascally.configure(config).done(function () {
    //
    //         if (typeof cb === 'function') {
    //             cb();
    //         }
    //         t.emit('rabbit-connected', t.wascally)
    //
    //     });
    //
    //     return this;
    // }
})()
