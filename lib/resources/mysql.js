var debug = require('debug')('service-scaff:resources');

var Scaff = module.exports;

Scaff.mysql = function(_mysql) {
    if(typeof _mysql === 'undefined'){
        return this._mysql;
    }

    var t = this

    // janky client object detection
    if(_mysql._events){
        debug('passed mysql client')
        this._mysql = _mysql;
        t.emit('mysql-connected', this._mysql)
    }
    else{
        this._mysqlConfig = _mysql;
        this._mysql = require('mysql').createPool(_mysql)
        t.emit('mysql-connected', this._mysql)
    }


    return this;
}
