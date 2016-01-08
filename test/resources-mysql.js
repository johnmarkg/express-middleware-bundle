var assert = require('assert')
var rewire = require('rewire')
var factory = rewire('../lib/resources/mysql');
var request = require('supertest')



describe('resources/mysql', function(){
    it('exports a factory function', function(){
        assert.equal(typeof factory, 'function')
        assert.equal(typeof factory(), 'function')
    })

    it('label for debugging', function(){
        var callcount = 0;
        var label = 'passed-label'
        factory.__with__({
            debug: function(string){
                assert(string.indexOf(label) > -1)
                callcount++;
            }
        })(function () {
            var mysql = factory(label)
            mysql() // log something
            assert(callcount)
        });
    })

    it('setter, client', function(){
        var mysql = factory()
        mysql({query: function(){}, _events: true})
        assert(mysql()._events)
    })

    it('setter, config', function(){
        var mysql = factory()
        mysql({host: 'localhost'})
        assert(mysql()._events)
    })

    it('factory function returns function to set/get isolated clients', function(){
        var mysqlA = factory()
        assert.equal(typeof mysqlA, 'function')
        mysqlA({query: function(){}, _events: true, A: true})

        var mysqlB = factory()
        mysqlB({query: function(){}, _events: true, B: true})
        assert(mysqlB().B)

        assert.notDeepEqual(mysqlA(), mysqlB())
    })


    it('verify connection success', function(done){
        var service = require('../index')(['resources/mysql']);
        service.on('mysql-failed', function(err){
            assert(err)
            done()
        })
        service.mysql({
            host: 'localhost',
            port: 80
        })
    })

    it('get mysql in express route', function(done){
        var service = require('../index')(['resources/mysql']);

        service.mysql({
            _events: true,
            query: function(){}
        })

        service.express()
        service.app.get('/', function(req, res){
            assert(req.app.mysql().query)
            res.end()
        })

        request(service.app)
            .get('/')
            .expect(200, done)

    })


    // it('bound to server object', function(){
    //     var server = require('../index');
    //     assert(typeof server.mysql, 'function')
    // })
})
