(function () {
    'use strict';

    var debug = require('debug')('service-scaff:errors');

	// function uncaughtEmail(label, error){
    //     if(!this.sendEmail || !this.config('email')){
    //         console.error('UNCAUGHT ERROR: ');
    //         console.error(error)
    //         return;
    //     }
    //
	// 	var os = require("os");
	// 	var msg = 'Error: ' + error.stack.split("\n").join("\n") + "\n\n";
	// 	msg += 'Host: ' + os.hostname();
	// 	var subject = 'PatentCAM ' + label + ': ' + __filename;
    //
    //     this.sendEmail({
    //         text: msg,
    //         subject: subject
    //     }, function(){
	// 		throw error
	// 	})
	// 	// this.sendEmail(msg, subject, function(){
	// 	// 	throw error
	// 	// })
	// }

    exports.errorHandlerEmail = function() {

        debug('add errorHandlerEmail')
		var t = this;

        if(t.errorHandlerAdded){
            throw new Error('errorHandlerEmail, error handler already added')
        }

        if(!t.sendEmail || !t.config('email')){
            throw new Error('email module required for errorHandlerEmail')
        }

		// process.on('uncaughtException', uncaughtEmail.bind(t, 'uncaughtException') )
		// process.on('unhandledRejection', uncaughtEmail.bind(t, 'unhandledRejection') )

        // this.express()

        this.app.use(function(error, req, res, next) {

			if (!t.app.get('dontPrintErrors')) {
				console.error(error.stack);
			}

			res.status(500)
            res.end()
            // res.send(error.toString());

            if(typeof next === 'function'){
				next()
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

            t.sendEmail({
                text: msg,
                subject: 'PatentCAM Error: ' + req.protocol + '://' + req.get('host') + req.path,
            }, next);

		});
        t.errorHandlerAdded = true;
        return t;

    }


	exports.errorHandler = function() {

		debug('add errorHandler')
		var t = this;

        if(t.errorHandlerAdded){
            throw new Error('errorHandlerEmail, error handler already added')
        }

		this.app.use(function(error, req, res, next) {

			if (!t.app.get('dontPrintErrors')) {
				console.error(error.stack);
			}

			res.status(500).send(error.toString());

            if(typeof next === 'function'){
				next()
			}
		});
        t.errorHandlerAdded = true;

		return this;
	}

})()
