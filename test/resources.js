var assert = require('assert')


// var fakeredis = require('fakeredis');

describe('resources', function(){
    it('exports', function(){
        var service = require('../index')(['resources', 'config'])
        assert.equal(typeof service.connectToResources, 'function')
        assert.equal(typeof service.startOnResourcesConnected, 'function')
    })

    it('connectToResources success', function(done){
        var service = require('../index')(['resources', 'config'])
        service.once('resources-connected', function(){
            // assert(service.redis())
            // assert(service.mysql())
            // assert(!service.sphinxql())
            done()
        })

        service.mysql = function(){
            this.emit('mysql-connected')
        }
        service.redis = function(){
            this.emit('redis-connected')
        }

        service.config({})
        service.connectToResources(['redis', 'mysql'])
    })

    it('connectToResources failed', function(done){
        var service = require('../index')(['resources', 'config'])
        service.once('resources-failed', function(){
            // assert(service.redis())
            // assert(!service.mysql())
            // assert(!service.sphinxql())
            done()
        })

        service.mysql = function(){
            this.emit('mysql-failed')
        }
        service.redis = function(){
            this.emit('redis-connected')
        }

        service.config({})
        service.connectToResources(['redis', 'mysql'])
    })

    it('connectToResources timeout', function(done){
        var service = require('../index')(['resources', 'config'])
        service.connectToResourcesTimeout = 100;
        service.once('resources-failed', function(){
            // assert(!service.redis())
            done()
        })

        service.redis = function(){
            // this.emit('redis-connected')
        }

        service.config({})
        service.connectToResources('redis')
    })

    it('startOnResourcesConnected', function(done){
        var service = require('../index')(['resources'])

        service.on('online', function(port){
            assert(port)
            done()
        })
        service.startOnResourcesConnected()
        service.emit('resources-connected')
    })

    it('startOnResourcesConnected fail', function(done){
        var service = require('../index')(['resources'])

        service.start = function(port, cb){
            cb('fakeerror')
        }
        service.on('online-err', function(err){
            // console.info(arguments)
            assert(err)
            done()
        })
        service.startOnResourcesConnected(80, function(err){
            assert.equal(err, 'fakeerror')
            done()
        })
        service.emit('resources-connected')

    })

})
