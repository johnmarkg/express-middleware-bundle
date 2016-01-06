
var assert = require('assert')
var fakeredis = require('fakeredis');
var request = require('supertest');
var sinon = require('sinon');

var sessions = require('../lib/sessions')



describe.skip('functional', function(){
    var scaff = require('../index')
    it('sessions, no auth', function(done){
        var sessId, sessionCookie;
        var server = scaff.serviceScaff();

        server
            .config({redis: fakeredis.createClient('test')})
            .express()
            .connectToResources(['redis'])
            .addRedisSessions({saveUninitialized: true})
            .startOnResourcesConnected(0)

        server.app.get('/', function(req,res){
            res.end(req.session.id)
        })

        request(server.app)
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessionCookie = res.headers['set-cookie'][0];
                sessId = res.text

                request(server.app)
                    .get('/')
                    .set('cookie', sessionCookie)
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.equal(sessId, res.text)
                        done()
                    })
            })

    })

    it('session config defined in config()', function(done){
        var sessId, sessionCookie;

        var server = scaff.serviceScaff();
        server
            .config({redis: fakeredis.createClient('test'), session: {saveUninitialized: true, secret: 'abc'} })
            .express()
            .connectToResources(['redis'])
            .addRedisSessions()
            .startOnResourcesConnected(0)

        var server2 = scaff.serviceScaff();
        server2
            .config({redis: fakeredis.createClient('test'), session: {saveUninitialized: true, secret: 'abc'} })
            .express()
            .connectToResources(['redis'])
            .addRedisSessions()
            .startOnResourcesConnected(0)

        server.app.get('/', function(req,res){
            res.end(req.session.id)
        })
        server2.app.get('/', function(req,res){
            res.end(req.session.id)
        })

        request(server.app)
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessionCookie = res.headers['set-cookie'][0];
                sessId = res.text

                request(server.app)
                    .get('/')
                    .set('cookie', sessionCookie)
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.equal(sessId, res.text)
                        done()
                    })
            })

    })


})

describe('deserializeUserMysql', function(){

    it('deserializeUserMysql no roles', function(done){

        var queryStub = sinon.stub();
        queryStub.callsArgWith(2,null,[{id: 1, active: 1}])

        var mysql = {
            query: queryStub,
            _events: true
        }

        var _scaffMock = {
            mysql: function(){
                return mysql
            }
        }

        Object.assign(_scaffMock, sessions)

        _scaffMock.deserializeUserMysql('user_id', function(err, userObj){
            if(err){ throw err; }
            assert(!userObj.roles)
            assert.deepEqual(queryStub.getCall(0).args[1], ['user_id'])
            done();
        })
    })

    it('deserializeUserMysql with roles', function(done){

        var queryStub = sinon.stub();
        queryStub.callsArgWith(2,null,[{id: 1, active: 1, roles: 'roleA,roleB,'}])

        var mysql = {
            query: queryStub,
            _events: true
        }

        var _scaffMock = {
            mysql: function(){
                return mysql
            }
        }

        Object.assign(_scaffMock, sessions)

        // sessions.deserializeUserMysql.call(_scaffMock, 'user_id', function(err, userObj){
        _scaffMock.deserializeUserMysql('user_id', function(err, userObj){
            if(err){ throw err; }
            assert.deepEqual(userObj.roles, {roleA: true, roleB: true})
            assert.deepEqual(queryStub.getCall(0).args[1], ['user_id'])
            done();
        })
    })

    it('deserializeUserMysql db err', function(done){

        var queryStub = sinon.stub();
        queryStub.callsArgWith(2,'fake error')

        var mysql = {
            query: queryStub,
            _events: true
        }

        var _scaffMock = {
            mysql: function(){
                return mysql
            }
        }

        Object.assign(_scaffMock, sessions)

        _scaffMock.deserializeUserMysql('user_id', function(err){
            assert.equal(err, 'fake error')
            done();
        })
    })


})

describe('serializeUser', function(){
    it('serializeUser', function(done){
        sessions.serializeUser(1, function(err, id){
            if(err){ throw err; }
            assert.equal(id, 1)
            done()
        })
    })
})

describe('redis sessions', function(){

    // it('exports', function(){
    //     assert.equal(Object.keys(sessions).length, 4)
    // })

    it('no redis config', function() {
        assert.throws(function() {
            sessions.redisSessions();
            },
            /redis config or client required/
        );
    })

    it.skip('redis client passed', function(){
        var _sess = sessions.redisSessions({client: fakeredis.createClient('test')})
        assert.equal(typeof _sess , 'function')
    })

    it.skip('redis config passed', function(){
        var _sess = sessions.redisSessions({host:'localhost', port: 65535} )
        assert.equal(typeof _sess , 'function')
    })

    it('saveUninitialized false', function(done){

        var app = require('express')()
        sessions.redisSessions( app, {client: fakeredis.createClient('test')})

        app.get('/', function(req,res){
            res.end(req.session.id)
        })

        var sessId;
        var agent = request.agent(app);
        agent
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessId = res.text
                agent
                    .get('/')
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.notEqual(sessId, res.text)
                        done()
                    })
            })
    })
    it('saveUninitialized true', function(done){

        var app = require('express')()

        sessions.redisSessions( app, {client: fakeredis.createClient('test')}, { saveUninitialized: true })

        app.get('/', function(req,res){
            res.end(req.session.id)
        })

        var sessId;
        var agent = request.agent(app);
        agent
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessId = res.text
                agent
                    .get('/')
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.equal(sessId, res.text)
                        done()
                    })
            })
    })


    it('session saved when req.session is modified', function(done){
        var app = require('express')()
        sessions.redisSessions( app, {client: fakeredis.createClient('test')})

        var count = 0;
        app.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })

        var sessId;
        var agent = request.agent(app);
        agent
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessId = res.text
                agent
                    .get('/')
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.equal(sessId, res.text)
                        done()
                    })
            })
    })

    it('cross app success, same secret and key', function(done){
        var app1 = require('express')()
        var app2 = require('express')()
        sessions.redisSessions( app1, {client: fakeredis.createClient('test')}, {secret: 'secret', key: 'key'} )
        sessions.redisSessions( app2, {client: fakeredis.createClient('test')}, {secret: 'secret', key: 'key'} )

        var count = 0;
        app1.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })
        app2.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })

        var sessId;
        var sessionCookie;

        request(app1)
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessionCookie = res.headers['set-cookie'][0];
                sessId = res.text

                request(app2)
                    .get('/')
                    .set('cookie', sessionCookie)
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.equal(sessId, res.text)
                        done()
                    })
            })
    })

    it('cross app success, different secret', function(done){
        var app1 = require('express')()
        var app2 = require('express')()
        sessions.redisSessions( app1, {client: fakeredis.createClient('test')}, {secret: 'secret', key: 'key'} )
        sessions.redisSessions( app2, {client: fakeredis.createClient('test')}, {secret: 'secret2', key: 'key'} )

        // // app2.passport.deserializeUser = function*()
        // app2.passport.deserializeUser(function(string, done){
        //     console.info('deserializeUser')
        //     console.info(string)
        // });

        var count = 0;
        app1.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })
        app2.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })

        var sessId;
        var sessionCookie;

        request(app1)
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }

                sessionCookie = res.headers['set-cookie'][0];
                sessId = res.text

                request(app2)
                    .get('/')
                    .set('cookie', sessionCookie)
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.notEqual(sessId, res.text)
                        done()
                    })
            })
    })

    it('cross app success, different key', function(done){
        var app1 = require('express')()
        var app2 = require('express')()
        sessions.redisSessions( app1, {client: fakeredis.createClient('test')}, {secret: 'secret', key: 'key'} )
        sessions.redisSessions( app2, {client: fakeredis.createClient('test')}, {secret: 'secret', key: 'key2'} )

        var count = 0;
        app1.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })
        app2.get('/', function(req,res){
            req.session.count = count++
            res.end(req.session.id)
        })

        var sessId;
        var sessionCookie;

        request(app1)
            .get('/')
            .end(function(err, res){
                if(err){ throw err; }
                sessionCookie = res.headers['set-cookie'][0];
                sessId = res.text

                request(app2)
                    .get('/')
                    .set('cookie', sessionCookie)
                    .end(function(err,res){
                        if(err){ throw err; }
                        assert.notEqual(sessId, res.text)
                        done()
                    })
            })
    })


})
