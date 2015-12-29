(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:middleware');

    //----------------------------------------
    // basic middleware
    //----------------------------------------
    Scaff.addQueryAndBodyParser = function () {
        debug('addQueryAndBodyParser')
        var bodyParser = require('body-parser');

        var config = {
            extended: true
        }
        if (this.maxBodySize) {
            config.limit = '2mb'
        }

        this.app.use(bodyParser.json(config));
        this.app.use(bodyParser.urlencoded(config));

        return this;
    }

    Scaff.addCookieParser = function () {
        debug('addCookieParser')
        if (this.addedCookieParser) {
            return this;
        }
        var cookieParser = require('cookie-parser');
        this.app.use(cookieParser());
        this.addedCookieParser = true;
        return this;
    }

    Scaff.addGzip = function (options) {
        debug('addGzip: ' + JSON.stringify(options || {}));
        if (this.addedGzip) {
            return this;
        }

        var compression = require('compression')
        this.app.use(compression(options || {}));
        this.addedGzip = true;
        return this;
    }
})()
