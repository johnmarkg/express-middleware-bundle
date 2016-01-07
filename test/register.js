var assert = require('assert')
var sinon = require('sinon')
var seaport = require('seaport');

describe('register', function(){
    it('exports', function(){
        var server = require('../index')(['register'])
        assert.equal(typeof server.register, 'function')
    })

    it('log that config("register") is needed to register', function(){
        var server = require('../index')(['register'])
        var spy = sinon.stub(console, 'info')

        server.register('label')

        assert.equal(spy.callCount, 1)
        assert(spy.calledWith('skipping registration, no config found'))
    })

    it('connects with seaport', function(done){

        var port = seaport.createServer()
        port.listen();
        port.on('register', function (service, id){
            assert(id)
            assert.equal(service.role, 'test-service')
            assert.deepEqual(service.aliases, ['alias'])
            done()
        })


        var server = require('../index')(['register','config'])
        server.config('register',{routers: [{port: port.address().port}]} )
        server.register('test-service', null, ['alias'])
        server.emit('online')

    })
})
