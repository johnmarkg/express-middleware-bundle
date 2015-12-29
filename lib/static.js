(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:static');
    var fs = require('fs');
    var express = require('express');


    //----------------------------------------
    // static files, templates
    //----------------------------------------
    Scaff.addStaticDir = function (dir, route) {
        if (!dir) {
            throw new Error('addStaticDir: dir required')
        }

        try {
            var stat = fs.statSync(dir);
            if (!stat.isDirectory()) {
                throw new Error('addStaticDir: `' + dir +
                    '` is not a directory')
            }
        } catch (err) {
            throw err
        }

        debug('addStaticDir: ' + dir + ', ' + route)

        if (route) {
            this.app.use(route, express.static(dir));
        } else {
            this.app.use(express.static(dir));
        }

        return this;
    }
    Scaff.addJade = function (dir) {
        if (!dir) {
            throw new Error('addJade: dir required')
        }
        try {
            var stat = fs.statSync(dir);
            if (!stat.isDirectory()) {
                throw new Error('addJade: `' + dir +
                    '` is not a directory')
            }
        } catch (err) {
            throw err
        }
        // if(!options){
        // 	options = {
        // 		prettyprint: true
        // 	};
        // }

        this.app.set('views', dir);
        this.app.set('view engine', 'jade');
        // this.app.set('view options', options);
        return this;
    }

})()
