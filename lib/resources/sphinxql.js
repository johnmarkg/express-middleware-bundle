(function () {
    'use strict';

    var debug = require('debug')('service-scaff:resources');

    exports.sphinxql = function (_sphinxql) {

        if (typeof _sphinxql === 'undefined') {
            return this._sphinxql;
        }

        var t = this
            // janky client object detection
        if (_sphinxql._events) {
            debug('passed sphinxql client')
            t.emit('sphinxql-connected', _sphinxql)
        } else {
            this._sphinxqlConfig = _sphinxql;
            _sphinxql = require('mysql').createPool(_sphinxql)
            t.emit('sphinxql-connected', _sphinxql)
        }
        this._sphinxql = _sphinxql;
        return this;

    }
})()
