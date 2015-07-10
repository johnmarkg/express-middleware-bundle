Utils to assist in testing http requests.  Find an open port, start the server, and start sending requests.  Built in status code checks and json response checks.

Test running servers by setting `MOCHA_HOST="http://yoururl"` on the command line or when creating the object:

Any [request option](https://github.com/request/request#requestoptions-callback) from request module may be passed in first param of `mochaHttp.http(options, cb)`.

Local tests:
```
// server-module.js

var http = require('http')

var server = http.createServer(function (req, res) {
	...
});

exports.listen = server.listen;
```

```
// test.js

var mochaHttp = require('mocha-http-utils')
var serverModule = require('../server-module');

//************************************************
//
// start up test server on open local port
//
// if MOCHA_HOST is defined, the cb to openPort
//   is never called, so local server is not started
//
//************************************************
before(function(done){
	mochaHttp.openPort(function(err, port){
		serverModule.listen(port, done);
	})	
})

describe(function(){
	it('send a request', function(done){
		mochaHttp.http({
			path: 'api/check',
			params:{
				'filter': 'abs*'
			},
			body:{
				bodyData: "some text in here"
			},
			json:{
				'[0].object1.key1': true,
				'[0].object1.key2': false,
				'[0].object2.key1': 123,
				'[1]': 'scalar'
			},

			method: 'GET', // default
			status: 200, // default
		}, done)
	})
})

```

local server: `~ mocha`

remote server: `~ MOCHA_HOST="http://test-target-url" mocha`


