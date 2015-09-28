var email   = require("emailjs/email");

exports.send = function sendEmail(smtpConfig, msg, subject, html, to, from,  cb){

	if(typeof to == 'function'){
		cb = to;
		to = null
	}
	if(typeof from == 'function'){
		cb = from;
		from = null
	}
	var server  = email.server.connect({
	   user:    smtpConfig.user,
	   password: smtpConfig.password,
	   host:    smtpConfig.host,
	   ssl:     smtpConfig.ssl,
	   tls:  smtpConfig.tls
	});


	var message = {
	   text:    msg,  //"i hope this works",
	   from:    from || 'patentcam@ipcheckups.com' ,
	   to:      to || smtpConfig.defaulRecepient,
	   subject: subject,
	};
    if(html){
        message.attachment = [
            {data: msg, alternative: true},
        ];
    }

	// send the message and get a callback with an error or details of the message that was sent
    server.send(message, cb);
}
