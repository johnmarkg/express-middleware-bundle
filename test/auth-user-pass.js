(function() {

	var request = require('supertest')
    var async = require('async')
	var sinon = require('sinon')
	var fakeredis = require('fakeredis')
	var assert = require('assert')

    describe('login', function(){

        var server

        before(function(){
            server = require('../index')([
                'resources/redis',
                'resources/mysql',
                'sessions',
                'auth',
                'auth/user-pass',
                'middleware'
            ]);

            server.redis(fakeredis.createClient('test'))
            server.express();
            server.set('dontPrintErrors', true)
            server.addRedisSessions()
            server.authenticationLogin()

            server.post('/login', server.login() )
            server.get('/logout', server.logout() )
            server.authenticated();
            server.get('/authenticated', function(req, res){ res.end() })
            server.use(function(err, req, res, next){
                res.status(500)
                res.end(err.toString())
				if(next){ next()}
            })
        })

        it('authenticationLogin called again', function(){
            assert.doesNotThrow(function(){
                server.authenticationLogin()
            })
        })

        it('no mysql', function(done){
            request(server.app)
                .post('/login')
                .send({
                    username: 'a',
                    password: 'b'
                })
                .expect(500)
                .expect(/mysql required for login auth/, done)
        })

        it('default loginFn, mysql error', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,'fakerror');
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .post('/login')
                .send({
                    username: 'a',
                    password: 'b'
                })
                .expect(500)
                .expect(/fakerror/, done)
        })

        it('default loginFn, user not found', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,null,[]);
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .post('/login')
                .send({
                    username: 'a',
                    password: 'b'
                })
                .expect(401)
                .expect(/Unknown user/, done)
        })

        it('default loginFn, user inactive', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 0}]);
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .post('/login')
                .send({
                    username: 'a',
                    password: 'b'
                })
                .expect(401)
                .expect(/not active/, done)
        })

        it('default loginFn, found user', function(done){
            var agent = request.agent(server.app);
            async.series([
                function(_next){
                    agent
                        .get('/authenticated')
                        .expect(401)
                        .end(_next)
                },
                function(_next){
                    var queryStub = sinon.stub();
                    queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
                    server.mysql({_events: true, query: queryStub})

                    agent
                        .post('/login')
                        .send({
                            username: 'a',
        					password: 'b'
                        })
                        .expect(200, _next)
                },
                function(_next){
                    var queryStub = sinon.stub();
                    queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
                    server.mysql({_events: true, query: queryStub})

                    agent
                        .get('/authenticated')
                        .expect(200)
                        .end(_next)
                }
            ], done)
        })




        it('default logout', function(done){
            var agent = request.agent(server.app);
            async.series([
                function(_next){

                    var queryStub = sinon.stub();
                    queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
                    server.mysql({_events: true, query: queryStub})

                    agent
                        .post('/login')
                        .send({
                            username: 'a',
        					password: 'b'
                        })
                        .expect('set-cookie', new RegExp(server.sessionCookieLabel + '=.+;'))
                        .expect(200, _next)
                },
                function(_next){

                    var queryStub = sinon.stub();
                    queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
                    server.mysql({_events: true, query: queryStub})

                    agent
                        .get('/logout')
                        .expect('set-cookie', new RegExp(server.sessionCookieLabel + '=;'))
                        .expect(302, _next)
                }
            ], done)
        })

		it('custom loginFn', function(done){
			server.loginFn = function(req, u, p, cb){
				assert.equal(u, 'user')
				assert.equal(p, 'b')
				cb(null, {id: 1, active: 1})
			}

			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'b'
				})
				.expect(200, done)
        })

    })








})()
