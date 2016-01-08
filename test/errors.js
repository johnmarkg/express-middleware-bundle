var assert = require('assert')
var request = require('supertest')
var sinon = require('sinon')

describe('errors', function () {
    it('exports', function () {
        var service = require('../index')(['errors'])
        assert.equal(typeof service.errorHandlerEmail,
            'function')
        assert.equal(typeof service.errorHandler, 'function')
    })

    it('errorHandlerEmail requires config and sendEmail', function () {
        var service = require('../index')(['errors', 'config'])

        service.express();
        assert.throws(function(){
            service.errorHandlerEmail()
        })

        service.config('email', {fake: 'config'})
        assert.throws(function(){
            service.errorHandlerEmail()
        })

        service.sendEmail  = function(){}
        assert.doesNotThrow(function(){
            service.errorHandlerEmail()
        })

        assert.throws(function(){
            service.errorHandlerEmail()
        },/already added/)

    })

    it('errorHandlerEmail', function (done) {
        var service = require('../index')(['errors', 'config'])


        service.sendEmail = function(msgOptions){
            console.info('sendEmail')
            console.info(msgOptions)
            assert(msgOptions.text)
            assert(msgOptions.subject)
            done()
        }

        service.config('email', {
            email: 'fake config'
        })

        service.express();
        service.set('dontPrintErrors', true)
        service.get('/', function (req, res, next) {
            // req.user
            next(new Error('fakeerror'))
        })
        service.errorHandlerEmail()

        request(service.app)
            .get('/')
            .expect(500)
            .end(function(err){
                assert(!err)
            })
    })

    it('errorHandler', function (done) {
        var service = require('../index')(['errors'])

        service.express();
        service.set('dontPrintErrors', true)
        service.get('/', function (req, res, next) {
            next('fakeerror')
        })
        service.errorHandler()

        request(service.app)
            .get('/')
            .expect(500, done)
    })

    it('errorHandler dontPrintErrors', function (done) {
        var service = require('../index')(['errors'])

        var stub = sinon.stub(console, 'error')

        service.express();
        service.get('/', function (req, res, next) {
            next('fakeerror')
        })
        service.errorHandler()

        request(service.app)
            .get('/')
            .expect(500)
            .end(function(err){
                assert(!err)
                assert.equal(stub.callCount, 1)
                done()
            })
    })


    it('errorHandler double add', function () {
        var service = require('../index')(['errors'])

        service.express();
        service.errorHandler()
        assert.throws(function(){
            service.errorHandler()
        })
    })





})
