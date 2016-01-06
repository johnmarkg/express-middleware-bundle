(function () {
    'use strict';

    var debug = require('debug')('service-scaff:register');

    exports.register = function (label, checkPath, aliases) {
        var t = this;
        if (!this.config('register')) {
            console.info('skipping registration, no config found')
            return this;
        }

        var seaport = require('seaport');

        t.on('online', function(appPort){

            t.config('register').routers.forEach(function(router){
                debug('register with seaport @ ' + (router.host || 'localhost') + ':' + router.port);
                var ports = seaport.connect({
                    host: router.host || 'localhost',
                    port: router.port
                });

                ports.register(label, {
                    aliases: aliases,
                    port: appPort
                });

            })

        })



        return this;
    }
})()
