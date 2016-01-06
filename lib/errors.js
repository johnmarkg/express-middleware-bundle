(function () {
    'use strict';

    var debug = require('debug')('service-scaff:errors');

	function uncaught(label, error){
        if(!this.sendEmail || !this.config('email')){
            console.error('UNCAUGHT ERROR: ');
            console.error(error)
            return;
        }

		var os = require("os");
		var msg = 'Error: ' + error.stack.split("\n").join("\n") + "\n\n";
		msg += 'Host: ' + os.hostname();
		var subject = 'PatentCAM ' + label + ': ' + __filename;

		this.sendEmail(msg, subject, function(){
			throw error
		})
	}
	exports.errorHandler = function() {

		debug('add errorHandler')
		var t = this;

		if(t.config('email')){
			process.on('uncaughtException', uncaught.bind(t, 'uncaughtException') )
			process.on('unhandledRejection', uncaught.bind(t, 'unhandledRejection') )
		}

		this.app.use(function(error, req, res, next) {

			if (!t.app.get('dontPrintErrors')) {
				console.error(error.stack);
			}

			res.status(500).send(error.toString());

            if(typeof next === 'function'){
				next()
			}

            if(!t.sendEmail || !t.config('email')){
                return
            }


				var msg = ''//'<html><body>'

				msg += 'Path: ' + req.path + "\n\n";
				msg += 'Query: ' + JSON.stringify(req.query, null, 4) + "\n\n";
				msg += 'Body: ' + JSON.stringify(req.body, null, 4) + "\n\n";
				msg += 'Url: ' + req.url + "\n\n";
				msg += "-------------------------------\n\n"
				msg += 'Error: ' + error.stack.split("\n").join("\n") + "\n\n";
				msg += "-------------------------------\n\n"
				msg += 'User: ' + JSON.stringify(req.user, null, 4) + "\n\n";
				// msg += '<p>Request: ' + req.url + '</p>';
				// msg += '<p>Query: ' + JSON.stringify(req.query, null, 4) + '</p>';
				// msg += '<p>Error: ' + JSON.stringify(error.stack, null, 4) + '</p>';
				// msg += '<p>User: ' + JSON.stringify(req.user, null, 4) + '</p>';
				// msg += '</body></html>'


                // msg, subject, html, to, from, cb


                t.sendEmail(
					msg,
					'PatentCAM Error: ' + req.protocol + '://' + req.get('host') + req.path,
					next
				)


		});

		return this;
	}

})()
