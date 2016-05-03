(function () {
    'use strict';

    var email = require("emailjs/email");

    exports.sendEmail = function (mailParams, cb) {
    // exports.sendEmail = function (msg, subject, html, to, from, cb) {
        if(typeof cb != 'function'){
            cb = function(){}
        }

        if (!this.config('email')) {
            if (typeof cb == 'function') {
                cb(new Error(
                    'email config is required: service.config("email", configObject)'
                ))
            }
            return
        }


        var smtpConfig = this.config('email');
        var emailClient = email.server.connect({
            user: smtpConfig.user,
            password: smtpConfig.password,
            host: smtpConfig.host,
            port: smtpConfig.port,
            ssl: smtpConfig.ssl,
            tls: smtpConfig.tls
        });

        if(!mailParams.to){
            mailParams.to = smtpConfig.defaultTo
        }
        if(!mailParams.from){
            mailParams.from = smtpConfig.defaultFrom
        }

        emailClient.send(mailParams, cb);

        return this;
    }

    // function sendEmail(smtpConfig, mailParams, cb) {
    // // function sendEmail(smtpConfig, msg, subject, html, to, from, cb) {
    //
    //     var emailClient = email.server.connect({
    //         user: smtpConfig.user,
    //         password: smtpConfig.password,
    //         host: smtpConfig.host,
    //         port: smtpConfig.port,
    //         ssl: smtpConfig.ssl,
    //         tls: smtpConfig.tls
    //     });
    //
    //     if(!mailParams.to){
    //         mailParams.to = smtpConfig.defaultTo
    //     }
    //     if(!mailParams.from){
    //         mailParams.from = smtpConfig.defaultFrom
    //     }
    //
    //     emailClient.send(mailParams, cb);
    // }


})()
