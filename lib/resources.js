(function () {
    'use strict';

    var Scaff = module.exports;

    var debug = require('debug')('service-scaff:resources');

	Scaff.connectToResources = function(resources) {
		if(typeof resources == 'string'){
			resources = [resources]
		}
		var t = this;

		var connected = 0;
		var failed = 0;
		// var count = resources.length
		var connectedHash = {};

		var time = 1000 * 30
		var timer = setTimeout(function(){
			t.emit('resources-failed', 'timeout: ' + time)
		}, time)

		resources.forEach(function(r){
			connectedHash[r] = false;
			debug('connectToResources: ' + r)

			t.once(r + '-connected', function(){
				debug('connectToResources, connected: ' + r)
				// console.info(r + ' connected');

				delete connectedHash[r]
				if(Object.keys(connected).length == 0){
					clearTimeout(timer)
					t.emit('resources-connected')
				}
			})
			t.once(r + '-failed', function(){
				debug('connectToResources, failed: ' + r)
				connectedHash[r] = failed;
				clearTimeout(timer)
				t.emit('resources-failed', r)
			})

			t[r].call(t, t.config(r))
		});

		return this;
	}

	Scaff.startOnResourcesConnected = function(_port){
		var t = this;

		var version = ''
		try{
			var pjson = require(module.parent.filename + '/../package.json');
			version  = pjson.version
		}
		catch(e){
			// console.info('package.json not found')
		}


		this.on('resources-connected', function(){
		    t.start(_port || 0, function(err, port) {
				if(err){ throw err; }
				console.info(module.parent.filename + ' ' + version + ' started on port ' + port);
		    });
		})
	}
})()
