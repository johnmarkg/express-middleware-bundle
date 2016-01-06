(function(){
    'use strict';

    exports.config = function(key,_config) {

    	if(typeof key == 'object'){
    		this._config = key;
    		return this;
    	}

    	if(!this._config){
    		this._config = {}
    	}
    	if(typeof _config === 'undefined'){
    		return this._config[key]
    	}
    	this._config[key] = _config
    	return this;
    }

    exports.cookieConfig = function(_config) {
    	this._cookieConfig = _config;
    	return this;
    }

})()
