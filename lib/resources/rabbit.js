(function () {
    'use strict';
    var debug = require('debug')('service-scaff:resources');

    var Scaff = module.exports;

    Scaff.rabbit = function (wascallyConfig, cb) {
        debug('rabbit')
        if (typeof wascallyConfig === 'undefined') {
            return this.wascally;
        }

        var config = {};

        if (!wascallyConfig.connection) {
            config.connection = wascallyConfig
        } else {
            config = wascallyConfig
        }

        this._rabbitConfig = config;
        this.wascally = require('wascally');
        var t = this;

        this.wascally.configure(config).done(function () {

            if (typeof cb === 'function') {
                cb();
            }
            t.emit('rabbit-connected', t.wascally)

        });

        return this;
    }
})()
