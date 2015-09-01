	
	var colors = require('colors');

	function timeNow() {
		var d = new Date(),
			M = pad(d.getUTCMonth() + 1),
			D = pad(d.getUTCDate()),
			h = pad(d.getUTCHours()),
			s = pad(d.getUTCSeconds()),
			// ms = d.getUTCMilliseconds(),
			m = pad(d.getUTCMinutes());

		// while (ms.toString().length < 4) {
		// 	ms += '0';
		// }
		// return h + ':' + m + ' ' + s + '.' + ms + 'Z ' + M + '/' + D;
		return M + '/' + D + ' ' +h + ':' + m + ':' + s;
	}

	function pad(input, length, padChar){
		input = input.toString();
		if(!padChar){ padChar = '0'; }
		if(!length){ length = 2; }
		while(input.length < length){
			input = padChar + input;
		}
		return input;
	}

	function logTokenCustomStatus(req, res) {
		var status = res.statusCode;

		if (status >= 500) {
			return status.toString().red;
		} else if (status >= 400) {
			return status.toString().yellow;
		} else if (status >= 300) {
			return status.toString().cyan;
		} else {
			return status.toString().green
		}
	}

	function logTokenUrlWithUser(req, res) {
		var sections = [
			(req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress).gray
		]

		if (req.session && typeof req.user === 'object') {
			sections.push((req.user.username + ':' + req.user.id + ':' + req.user.group_id + ' ').gray)
		}
		if(req['_parsedOriginalUrl']){
			sections.push(req['_parsedOriginalUrl'].pathname)	
		}
		else{
			sections.push(req.originalUrl)
		}
		

		return sections.join(' ');
	}

	function logTokenParams(req, res) {
		var params = {};

		if(req.query){
			params.query = {};
			var queryKeys = Object.keys(req.query);
			for (var k in queryKeys) {
				var key = queryKeys[k];
				if(key === '_dc'){ continue; }
				if(key.match(/passw/)){ continue; }
				var v = req.query[key];
				if(!v){
					continue;
				}
				params.query[key] = v
			}		
			if(Object.keys(params.query).length == 0){
				delete params.query
			}	
		}

		if(req.body && Object.keys(req.body).length > 0){
			var keys = Object.keys(req.body);
			params.body = {};
			for (var k in keys) {
				var key = keys[k];
				// if(key === '_dc'){ continue; }
				if(key.match(/passw/)){ continue; }
				var v = req.query[key];
				if(!v){
					continue;
				}
				params.body[key] = v				
			}
			if(Object.keys(params.body).length == 0){
				delete params.body
			}				
		}

		if(Object.keys(params).length == 0){
			return ' '
		}				
		return JSON.stringify(params).bold.gray;
	}

	exports.addTokens = function (morgan){
		// console.info(morgan)
		morgan.token('customStatus', logTokenCustomStatus);
		morgan.token('customMethod', function(req, res) {
			// pad(req.method, 4, ' ')
			if(req.method == 'GET'){
				return pad(req.method, 4, ' ').green;	
			}
			return pad(req.method, 4, ' ').yellow;
		});
		// morgan.token('reqString', function() {
		// 	return 'REQ'.gray
		// });
		// morgan.token('decodedUrl', function(req, res) {
		// 	return decodeURI(req.url);
		// });
		morgan.token('time', function(req, res) {
			// return wrapColor(90, timeNow());
			return timeNow().gray;
		});
		morgan.token('urlWithUser', logTokenUrlWithUser);

		morgan.token('customUa', function(req, res) {
			if (req.url.match('session/init')) {
				return req.headers['user-agent'];
			}
			return ' ';
		});

		morgan.token('responseTime', function(req, res) {
			var elapsed = Date.now() - req._startTime;
			var msg = elapsed + 'ms'
			if (elapsed > 15 * 1000) {
				msg += ' SLOW'
				return msg.red;
			}
			return msg.cyan;

		});

		morgan.token('params', logTokenParams);
	}

	exports.addFormat = function(morgan){
		
	}