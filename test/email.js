var assert = require('assert')
var server = require('../index')(['email', 'config'])

describe('email', function () {
    it('exports', function () {
        assert.equal(typeof server.sendEmail, 'function')
    })

    it('graceful fail with no config', function () {
        assert.doesNotThrow(function () {
            server.sendEmail()
        })

        server.sendEmail({
            text: 'msg',
            subject: 'subject'
        }, function (err) {
            assert(err.toString().match(/config/))
        })
    })


    it('send email no html', function (done) {
        var SMTPServer = require('smtp-server').SMTPServer;

        var smtp = new SMTPServer({
            logger: false,
            // tls: false,
            // secure: false,
            // hideSTARTTLS: true,
            onAuth: function (auth, session, callback) {
                assert.equal(auth.username, 'user')
                assert.equal(auth.password,
                    'password')
                callback(null, {
                    user: 123
                });
            }
        });

        smtp.listen(function () {

            server.config('email', {
                port: smtp.server.address().port,
                host: '127.0.0.1',
                user: 'user',
                password: 'password',
                defaultTo: 'you@test',
                defaultFrom: 'me@test',
                tls: true
            })

            server.sendEmail({
                text: 'msg',
                subject: 'subject'
            }, function (err, msg) {
                assert(!err)
                assert(!msg.attachments.length)
                assert(!msg.alternative)
                assert.equal(msg.text, 'msg')
                assert.equal(msg.header.from,
                    'me@test')
                assert.equal(msg.header.to,
                    'you@test')
                done()
            })
        });
    })


    it('send email with html', function (done) {
        var SMTPServer = require('smtp-server').SMTPServer;

        var smtp = new SMTPServer({
            logger: false,
            // tls: false,
            // secure: false,
            // hideSTARTTLS: true,
            onAuth: function (auth, session, callback) {
                assert.equal(auth.username, 'user')
                assert.equal(auth.password,
                    'password')
                callback(null, {
                    user: 123
                });
            }
        });

        smtp.listen(function () {

            server.config('email', {
                port: smtp.server.address().port,
                host: '127.0.0.1',
                user: 'user',
                password: 'password',
                defaultTo: 'you@test',
                defaultFrom: 'me@test',
                tls: true
            })

            server.sendEmail({
                text: 'msg',
                subject: 'subject',
                attachment: [{
                    data: 'PLAIN',
                    alternative: true
                    }]
            }, function (err, msg) {

                assert(!err)
                assert(msg.alternative)
                assert.equal(msg.text, 'msg')
                assert.equal(msg.header.from,
                    'me@test')
                assert.equal(msg.header.to,
                    'you@test')
                done()
            })


        });
    })

    it('send email pass from/to', function (done) {
        var SMTPServer = require('smtp-server').SMTPServer;

        var smtp = new SMTPServer({
            logger: false,
            // tls: false,
            // secure: false,
            // hideSTARTTLS: true,
            onAuth: function (auth, session, callback) {
                assert.equal(auth.username, 'user')
                assert.equal(auth.password,
                    'password')
                callback(null, {
                    user: 123
                });
            }
        });

        smtp.listen(function () {

            server.config('email', {
                port: smtp.server.address().port,
                host: '127.0.0.1',
                user: 'user',
                password: 'password',
                defaultTo: 'you@test',
                defaultFrom: 'me@test',
                tls: true
            })

            server.sendEmail({
                text: 'text',
                subject: 'subj',
                to: 'to@to',
                from: 'from@from'
            }, function (err, msg) {
                assert(!err)
                assert.equal(msg.header.from,
                    'from@from')
                assert.equal(msg.header.to,
                    'to@to')
                done()
            })
        });
    })


})
