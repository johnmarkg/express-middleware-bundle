(function () {
    'use strict';

    var email = require("emailjs/email");

    var Scaff = module.exports;


    Scaff.sendEmail = function(msg, subject, html, to, from, cb) {

		if(!this.config('email')){
			if(typeof cb == 'function'){
				cb(new Error('email config is required: serviceScaff.config("email", configObject)'))
			}
			return
		}
		// var email = require('./lib/email');
		sendEmail(this.config('email'), msg, subject, html, to, from, cb)
        return this;
	}

    function sendEmail(smtpConfig, msg, subject, html, to,
        from, cb) {

        if (typeof html == 'function') {
            cb = html;
            html = null
        } else if (typeof to == 'function') {
            cb = to;
            to = null
        } else if (typeof from == 'function') {
            cb = from;
            from = null
        }
        var server = email.server.connect({
            user: smtpConfig.user,
            password: smtpConfig.password,
            host: smtpConfig.host,
            ssl: smtpConfig.ssl,
            tls: smtpConfig.tls
        });


        var message = {
            text: msg, //"i hope this works",
            from: from || 'patentcam@ipcheckups.com',
            to: to || smtpConfig.defaulRecepient,
            subject: subject,
        };
        if (html) {
            message.attachment = [
                {
                    data: msg,
                    alternative: true
                },
        ];
        }

        // send the message and get a callback with an error or details of the message that was sent
        server.send(message, cb);
    }
})()
