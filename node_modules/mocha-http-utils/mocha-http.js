(function() {


    var assert = require('assert');
    var request = require('request');

	var portfinder = require('portfinder');
	var debug = require('debug')('tests:http');

	function Tests(host){
		this.port = null;
		this.host = host || process.env.MOCHA_HOST || 'http://localhost';
		this.defaultParams = {};
		
		return this;
	}

	module.exports = new Tests();

	// access to constructor
	Tests.prototype.MochaHttpUtils = function(host){
		return new Tests(host);	
	}

	Tests.prototype.deleteDefaultParam = function(key) {
		delete this.defaultParams[key];
		return this;
	};
	Tests.prototype.setDefaultParam = function(key, val) {
		this.defaultParams[key] = val;
		return this;
	};

	Tests.prototype.url = function(path, params) {

		// for(var key in this.defaultParams){
			
		// 	if(params && typeof params[key] !== 'undefined'){
		// 		continue;
		// 	}
		// 	path += addParamTerminator(path);
		// 	path += encodeURIComponent(key) + '=' + encodeURIComponent(this.defaultParams[key])
		// }			


		// if(params && Object.keys(params).length > 0){
		// 	for(var key in params){
		// 		if(params[key] == null){
		// 			continue;
		// 		}
		// 		path += addParamTerminator(path);
		// 		path += encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
		// 	}
		// }
		
		// path = path.replace(/&&/g, '&');
		debug(this.host + (this.port ? ':'+ this.port : '') + '/' + path);
		return this.host + (this.port ? ':'+ this.port : '') + '/' + path;

	}
	Tests.prototype.openPort = function(cb) {
		var t = this;
		if(process.env.MOCHA_HOST){
			return;
		}
        portfinder.getPort(function(err,_port){
        	t.port = _port
        	cb(err, t.port);
        });
	}

	function getQs(defaultParams, params){
		var qs = {};
		for(var key in defaultParams){
			
			if(params && typeof params[key] !== 'undefined'){
				continue;
			}
			qs[key] = defaultParams[key];
			// path += addParamTerminator(path);
			// path += encodeURIComponent(key) + '=' + encodeURIComponent(this.defaultParams[key])
		}			


		if(params && Object.keys(params).length > 0){
			for(var key in params){
				if(params[key] == null){
					continue;
				}
				qs[key] = params[key];
				// path += addParamTerminator(path);
				// path += encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
			}
		}	
		return qs;	
	}

	Tests.prototype.http = function(data,cb) {
		var t = this;
		var fn = (data.method || 'get').toLowerCase();

		var _cb = function(err,res,body){
			if(err){
				throw err;
			}

			assert.equal(res.statusCode, (data.status || 200));	  

			if(data.resHeaders){
	            for(var key in data.resHeaders){
	            	debug('compare headers: ' + key)
	            	// assert.equal(getProperty(json,key), data.resJson[key])
	            	assert.equal(res.headers[key], data.resHeaders[key])
	            }				
			}      

            if(data.resJson){
            	debug('check JSON');
            	// debug(typeof body)
            	var json = body;
            	if(typeof body !== 'object'){
					json = JSON.parse(body);
            	}
	            
	            for(var key in data.resJson){
	            	debug('compare json response: ' + key)
	            	assert.equal(getProperty(json,key), data.resJson[key])
	            }
            }

            if(typeof cb === 'function'){
            	cb(err,res,body);		
            }
		}

		// data.uri = (t.url(data.path, data.params));
		// data.method = (data.method || 'get').toUpperCase();
		// delete data.path;
		// delete data.params;

		// request(data,_cb);

		data.qs = getQs(this.defaultParams, data.qs)
		data.qs = getQs(this.defaultParams, data.params)

		var args =  [t.url(data.path, data.params, data.log)];
		delete data.path;
		delete data.params;		

		args.push(data);
		args.push(_cb);

		request[fn].apply(request, args);
	}

	function getProperty(o, s) {
	    s = s.replace(/\[(\w+)\]/g, '.$1');  // convert indexes to properties
	    s = s.replace(/^\./, ''); // strip leading dot
	    var a = s.split('.');

	    for (var i = 0, n = a.length; i < n; ++i) {
	        var key = a[i];
	        if (typeof o[key] === 'object') {
	            o = o[key];
	        } else {
	            return o[key];
	        }
	    }
	}


}).call(this)