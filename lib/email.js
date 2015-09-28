var email   = require("emailjs/email");

exports.send = function sendEmail(smtpConfig, msg, subject, to, from, cb){
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
	   // cc:      "else <else@your-email.com>",
	   subject: subject,
	   attachment:
	   [
	      {data: msg, alternative:true },
	      // {path:"path/to/file.zip", type:"application/zip", name:"renamed.zip"}
	   ]
	};

	// send the message and get a callback with an error or details of the message that was sent
	// server.send(message, function(err, message) { console.log(err || message); });
    server.send(message, cb);
}

// function test(to){
// 	sendEmail(config.smtp.ipc, '<b>hi</b>', 'test subject', to)
// }
//
//
//
// exports = {
// 	test: test
// }
//
//
// // test('mgarner@ipcheckups.com')
// test()
