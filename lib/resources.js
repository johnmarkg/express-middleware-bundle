(function () {

    'use strict';

    var debug = require('debug')('service-scaff:resources');

    exports.connectToResources = function (resources) {
        if (typeof resources == 'string') {
            resources = [resources]
        }
        var t = this;
        var connectedHash = {};
        var time = this.connectToResourcesTimeout || 1000 * 30
        var timer = setTimeout(function () {
            t.emit('resources-failed', 'timeout: ' + time)
        }, time)

        resources.forEach(function (r) {
            connectedHash[r] = false;
            debug('connectToResources: ' + r)
        })

        resources.forEach(function (r) {
            t.once(r + '-connected', function () {

                delete connectedHash[r]
                debug('connectToResources, connected: ' +
                    r)
                debug('connectedHash: ' + JSON.stringify(
                    connectedHash))

                if (Object.keys(connectedHash).length ==
                    0) {
                    clearTimeout(timer)
                    t.emit('resources-connected')
                }
            })

            t.once(r + '-failed', function () {
                debug('connectToResources, failed: ' +
                    r)
                connectedHash[r] = 'failed';
                clearTimeout(timer)
                t.emit('resources-failed', r)
            })

            t[r].call(t, t.config(r))
        });

        return this;
    }

    exports.startOnResourcesConnected = function (_port, cb) {
        var t = this;

        var scaffVersion = ''
        var appName = ''
        try {
            var pjson = require(module.parent.filename +
                '/../package.json');
            scaffVersion = pjson.version
        } catch (e) {
            // console.info('package.json not found')
        }

        try {
            var pjson = require(module.parent.parent.filename +
                '/../package.json');
            appName = (pjson.main || pjson.name) + '@' + pjson.version
        } catch (e) {
            // console.info('package.json not found')
        }


        this.once('resources-connected', function () {
            // t.start(_port || 0, cb)

            t.start(_port || 0, function (err, port) {
                if (err) {
                    if(typeof cb == 'function'){
                        return cb(err)
                    }
                    else{
                        throw err;
                    }
                }


                // console.info(module.parent.filename + ' ' + version + ' started on port ' + port);
                console.info((appName || process.title) +
                    " listening on port %d (pid: " +
                    process.pid +
                    "), using service-scaff@" +
                    scaffVersion, port)

                cb(null, port)
            });
        })
    }
})()
