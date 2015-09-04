(function() {

	process.setMaxListeners(20)

	var request = require('supertest');

	// var path = require('path');
	var sinon = require('sinon');

	var fakeredis = require('fakeredis');
	var mysql = fakemysql();

	var assert = require('assert');
	var server = require('../index');

	var sessionCookie;
	var rememberCookie;
	var cookieDomain = 'fakedomain.com'

	var spyError = sinon.spy(console, 'error');

	var Rabbus = require("rabbus");
	var Q = require('q');

	before(function() {

		server
			.redis(fakeredis.createClient('test'))
			.mysql(mysql)
			.cookieConfig({
				domain: cookieDomain
			})
			.web();

		server.app.set('dontPrintErrors', true)

		routes(server);

		server.errorHandler();
	});

	describe('errors', function() {
		var queryStub;
		var _server;
		beforeEach(function() {
			_server = server.serviceScaff();
			_server.express();
			_server.set('dontPrintErrors', true)

			if(mysql.query.restore){
				mysql.query.restore()
			}
			queryStub = sinon.stub(mysql, 'query')			
		});

		it('need a port', function() {
			assert.throws(function() {
				_server.start();
			}, /port required/);
		})

		it('no redis config', function() {
			assert.throws(function() {
				_server.addRedisSessions();
			}, /redis config or client required/);
		})

		it('authentication error', function(done) {

			_server.authenticationLogin(function(req, u, p, cb) {
				cb('authenticatibbbonLogin error');
			});
			_server.deserializeUser = function(string, cb) {
				return cb('serialize error')
			}

			_server.addRedisSessions({
				client: fakeredis.createClient('test')
			});
			_server.app.post('/login', _server.login.bind(_server));
			_server.errorHandler();

			request(_server.app)
				.post('/login')
				.send({
					username: 'a',
					password: 'b'
				})
				.expect(500, done)
		});

		it('req.login error', function(done) {
			queryStub.callsArgWith(2,null,[{id: 1, active: 1}])
			_server.authenticationLogin()
			_server.addRedisSessions({
				client: fakeredis.createClient()
			});

			_server.mysql(mysql)

			// insert fake req.login fn to route
			_server.app.post(
				'/login',
				function(req, res, next) {
					req.login = function(user, req, cb) {
						return cb(new Error('req.login error'))
					}
					next();
				},
				_server.login.bind(_server)
			);
			_server.errorHandler();

			request(_server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password'
				})
				.expect(500)
				.expect(/req.login error/, done)
		});

		it('dontPrintErrors false', function(done) {

			_server.set('dontPrintErrors', false)
			_server.app.get(
				'/',
				function(req, res, next) {
					next('expected error');
				}
			);
			_server.errorHandler();

			spyError.reset();

			request(_server.app)
				.get('/')
				.send({
					username: 'a',
					password: 'b'
				})
				.expect(500)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(3, spyError.callCount);
					done();
				});
		});

		it('dontPrintErrors true', function(done) {
			_server.set('dontPrintErrors', true)
			_server.app.get(
				'/',
				function(req, res, next) {
					next('expected error');
				}
			);
			_server.errorHandler();

			spyError.reset();

			request(_server.app)
				.get('/')
				.send({
					username: 'a',
					password: 'b'
				})
				.expect(500)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(0, spyError.callCount);
					done();
				});
		});

		it('verifyRememberMe, no redis', function() {
			assert.throws(function() {
				_server.verifyRememberMe('a')
			}, 'requires redis')
		})

		it('issueRememberMe, no redis', function() {
			assert.throws(function() {
				_server.issueRememberMe('a')
			}, 'requires redis')
		})

		it('apiAuth, no mysql', function() {
			assert.throws(function() {
				_server.apiAuth('a')
			}, 'mysql client required')
		})

		// it('verifyPassword err', function(done) {
		// 	server.verifyPassword(1, 2, null, function(err) {
		// 		assert(err)
		// 		done();
		// 	})
		// })

		it('deserializeUser err', function(done) {
			queryStub.callsArgWith(2, 'queryerror');
			server.deserializeUser(-1, function(err) {
				assert(err)
				done();
			})
		})
	});

	// describe('web, no redis or mysql', function() {
	// 	var _server = server.serviceScaff();
	// 	// var _mochaHttp = mochaHttp.MochaHttpUtils();

	// 	_server.web();

	// })

	describe('messages/shutdown', function() {

		it('start cb', function(done) {

			var _server2 = server.serviceScaff()
			_server2.express();
			_server2.start(0, function() {
				assert(true)
				done()
			})
		});

		it('online message', function(done) {
			process.send = function(msg) {
				assert(msg, 'online')
				delete process.send;
				done();
			}
			var _server2 = server.serviceScaff()
			_server2.express().start(0);
		});

		it('offline message', function(done) {

			var _server2 = server.serviceScaff()

			_server2.express().start(0, function() {
				process.send = function(msg) {
					assert(msg, 'offline')
					delete process.send;
					done();
				}
				_server2.shutdown();
			})

		});

		describe('shutdown', function() {

			var _server2 = server.serviceScaff()
			_server2.express();
			_server2.app.get('/slow/:ms', function(req, res) {

				setTimeout(function() {
					return res.end()
				}, req.params.ms);
			});
			_server2.shutdownTimeout = 600

			var _port;
			it('respond to pending request on shutdown', function(done) {
				_server2.start(0, function(err, p) {
					if(err){
						return done(err)
					}
					_port = p

					// request(_server2.server)
					// 	.get('/slow/1000')
					// 	.expect(500, done);

					request(_server2.server)
						.get('/slow/400')
						.expect(200, done);
					// .expect(200);

					setTimeout(function() {
						_server2.shutdown('shutdown message 2');
					}, 20)

					setTimeout(function() {

						request('http://127.0.0.1:' + _port)
							.get('/slow/100')
						// .expect(200)
						.end(function(err) {
							assert('ECONNREFUSED', err.code)
							// done();
						});
					}, 40)

				});

			});

			it('stop accepting new connections', function(done) {
				request('http://127.0.0.1:' + _port)
					.get('/slow/100')

				.end(function(err) {
					assert('ECONNREFUSED', err.code)
					done();
				});
			})

		})
		// it('accept no more requests', function(done) {

		// 	_server2.start(0, function(){
		// 		request(_server2.server)
		// 			.get('/slow/1000')
		// 			// .get('/')
		// 			.expect(200);	

		// 		_server2.shutdown();

		// 		request(_server2.server)
		// 			.get('/slow/100')
		// 			// .get('/')
		// 			.expect(500,done);					

		// 	});

		// });
	});

	describe('gzip', function() {
		var _server;

		before(function() {
			_server = server.serviceScaff();
			_server.express().addGzip({
				threshold: 1,
			});
			_server.addGzip() // still works with extra call to addGzip
			_server.app.get('/', function(req, res) {
				res.json({
					abc: 123
				})
			})
		});

		it('compressed', function(done) {
			request(_server.app)
				.get('/')
				.set('Accept-Encoding', 'gzip')
				.expect(200)
				.expect('content-encoding', 'gzip', done)
		});

		it('not compressesed, req headers', function(done) {
			request(_server.app)
				.get('/')
				.set('Accept-Encoding', '')
				.expect(200)
				.expect(function(res) {
					if (res.headers['content-encoding']) {
						return 'got content-encoding'
					}

				})
				.end(done);
		});

		it('not compressesed, threshold', function(done) {
			var _server = server.serviceScaff();

			_server.express().addGzip();

			_server.app.get('/', function(req, res) {
				res.json({
					abc: 123
				});
			});

			request(_server.app)
				.get('/')
				.set('Accept-Encoding', 'gzip,deflate')
				.expect(200)
				.expect(function(res) {
					if (res.headers['content-encoding']) {
						return 'got content-encoding'
					}
				})
				.end(done);
		});
	});

	describe('query and body parser', function() {

		it('query', function(done) {
			request(server.app)
				.get('/params')
				.query({
					param: 'hey',
					param2: 'hey2'
				})
				.expect('[{"param":"hey","param2":"hey2"},{}]', done)
		});

		it('body', function(done) {
			request(server.app)
				.post('/params')
				.send({
					param: 'hey',
					param2: 'hey2'
				})
				.expect('[{},{"param":"hey","param2":"hey2"}]', done)
		});
	});

	describe('sessions', function() {

		it('start session', function(done) {
			request(server.app)
				.get('/set-session')
				.query({
					key: 'started',
					value: 'yes'
				})
				.expect('set-cookie', /sessionId/, done)
		});

		it('check cookie domain', function(done) {
			request(server.app)
				.get('/set-session')
				.query({
					key: 'started',
					value: 'yes'
				})
				.expect('set-cookie', /sessionId/)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}
					sessionCookie = res.headers['set-cookie'][0];
					assert(sessionCookie.indexOf('Domain=' + cookieDomain + ';') > -1)
					done();
				})
		});

		it('check', function(done) {
			request(server.app)
				.get('/check-session')
				.set('cookie', sessionCookie)
				.query({
					key: 'started'
				})
				.expect('{"value":"yes"}', done)
		});

		it('different app using same store', function(done) {

			var _server = server.serviceScaff();
			_server.express().addRedisSessions({
				client: fakeredis.createClient('test')
			});

			_server.app.get('/check-session', function(req, res) {
				return res.json({
					value: req.session ? req.session[req.query.key] : false
				});
			});

			request(_server.app)
				.get('/check-session')
				.set('cookie', sessionCookie)
				.query({
					key: 'started'
				})
				.expect('{"value":"yes"}', done)
		});
	});

	describe('authentication', function() {
		var queryStub;
		beforeEach(function(){
			if(mysql.query.restore){
				mysql.query.restore()
			}
			queryStub = sinon.stub(mysql, 'query')
		})
		it('not yet', function(done) {
			request(server.app)
				.get('/authenticated')
				.expect(401, done)
		});

		it('missing username', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: '',
					password: 'password'
				})
				.expect(401)
				.expect(/"success":false/)
				.expect(/Missing credentials/, done)
		});

		it('missing password', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: ''
				})
				.expect(401)
				.expect(/"success":false/)
				.expect(/Missing credentials/, done)
		});

		it('failed login', function(done) {

			queryStub.callsArgWith(2,null, [])

			request(server.app)
				.post('/login')
				.send({
					username: 'user1',
					password: 'password'
				})
				.expect(401)
				.expect(/"success":false/)
				.expect(/Unknown user/, done)
		});

		it('apikey, mysql err', function(done) {
			queryStub.callsArgWith(2, 'mysqlerr')
			request(server.app)
				.post('/authenticated')
				.query({
					apikey: 'mysqlerr'
				})
				.expect(401, done)
		});

		it('apikey, inactive', function(done) {
			queryStub.callsArgWith(2, null, [{active: 0}]);
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: 'inactive'
				})
				.expect(401)
				.expect(/not active/, done)
		});

		it('bad apikey', function(done) {
			queryStub.callsArgWith(2, null, []);
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '1234'
				})
				.expect(401, done)
		});

		it('apikey, no session', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1}]);
			queryStub.onCall(1).callsArgWith(2, null, [{id: 1}]);

			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '123'
				})
				.expect(200)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}

					request(server.app)
						.post('/authenticated')
						.set('cookie', res.headers['set-cookie'][0])
						.expect(401, done)
				});
		});

		it('apikey, deserialize fail', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1}]);
			queryStub.onCall(1).callsArgWith(2, 'deserializeError');			
			// server.deserializeUser = function(uid, cb) {
			// 	cb(new Error('deserializeError'))
			// }
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '123'
				})
				.expect(500)
				.expect(/deserializeError/, done)
		});

		it('loginFn mysql error', function(done) {
			queryStub.onCall(0).callsArgWith(2, 'queryerr');
			request(server.app)
				.post('/login')
				.send({
					username: 'error',
					password: 'password'
				})
				.expect(500, done)
		});

		it('login inactive user', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 0, id: 1}]);
			request(server.app)
				.post('/login')
				.send({
					username: 'inactive',
					password: 'password'
				})
				.expect(401)
				.expect(/"success":false/)
				.expect(/not active/, done)
		});

		// it('salted password fail', function(done) {
		// 	request(server.app)
		// 		.post('/login')
		// 		.send({
		// 			username: 'salted',
		// 			password: 'salted'
		// 		})
		// 		.expect(401)
		// 		.expect(/"success":false/)
		// 		.expect(/password/, done)
		// });

		// it('salted password success', function(done) {
		// 	request(server.app)
		// 		.post('/login')
		// 		.send({
		// 			username: 'salted2',
		// 			password: 'salted'
		// 		})
		// 		.expect(200, done)
		// });

		it('login success', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1}]);
			queryStub.onCall(1).callsArgWith(2, null, [{active: 1, id: 1}]);
			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password'
				})
				.expect(200)
				// .expect(/\{"requestCount":1\}/, done)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}

					sessionCookie = res.headers['set-cookie'][0]
					request(server.app)
						.get('/authenticated')
						.set('cookie', sessionCookie)
						.expect(200)
						.expect(/\{"requestCount":1\}/, done)
				});
		});

		it('cross process, different session secret', function(done) {
			var _server = server.serviceScaff();
			_server.express().addRedisSessions({
				client: fakeredis.createClient('test')
			}, {
				secret: 'different secret'
			});

			// every route after this requires authentication
			_server.app.use(server.authenticated.bind(server));

			_server.app.get('/', function(req, res) {
				return res.json({
					value: req.session ? req.session[req.query.key] : false
				});
			});

			request(_server.app)
				.get('/')
				.set('cookie', sessionCookie)
				.expect(401, done)
		});

	});

	describe('api', function() {
		var queryStub;
		beforeEach(function(){
			if(mysql.query.restore){
				mysql.query.restore()
			}
			queryStub = sinon.stub(mysql, 'query')
		})

		it('requires redis', function() {
			var _server = server.serviceScaff();

			assert.throws(function() {
				_server.api();
			}, /redis/)

			assert.doesNotThrow(function() {
				_server.redis(fakeredis.createClient('test'))
				_server.api();
			})

		})

		it('default auth fails with no mysql', function(done) {
			var _server = server.serviceScaff();
			_server.redis(fakeredis.createClient('test'))
			_server.api();
			_server.use(_server.authenticated.bind(_server));
			_server.get('/authenticated', function(req, res) {
				res.end();
			});
			_server.errorHandler();

			_server.app.set('dontPrintErrors', true)

			request(_server.app)
				.get('/authenticated')
				.query({
					apikey: 1
				})
				.expect(500)
				.expect(/mysql.*required/, done)
		})

		it('no local strategy', function(done) {
			var _server = server.serviceScaff();
			_server
				.redis(fakeredis.createClient('test'))
				.mysql(mysql)
				.api();

			_server.post('/login', _server.login.bind(_server));
			_server.errorHandler();
			_server.app.set('dontPrintErrors', true)
			request(_server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password'
				})
				.expect(500)
				.expect(/Unknown authentication strategy/, done)
		});

		it('cookies work', function(done) {

			queryStub.callsArgWith(2, null, [{active: 1, id: 1}]);
			// queryStub.onCall(1).callsArgWith(2, null, [{active: 1, id: 1}]);
			
			var _server = server.serviceScaff();
			_server
				.redis(fakeredis.createClient('test'))
				.mysql(mysql)
				.cookieConfig({
					domain: cookieDomain
				})
				.api();

			// routes(_server);
			_server.post('/login', _server.login.bind(_server));
			_server.use(_server.authenticated.bind(_server));
			_server.get('/authenticated', function(req, res) {
				res.end();
			});
			_server.errorHandler();

			_server.app.set('dontPrintErrors', true)
			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password'
				})
				.expect(200)
				.end(function(err, res) {

					if (err) {
						return done(err)
					}
					var _cookie = res.headers['set-cookie'];
					request(_server.app)
						.get('/authenticated')
						.set('cookie', _cookie)
						.expect(200, done)

				})
		});

	});

	describe('checkRoles', function() {
		var queryStub;
		var sessionCookie
		before(function(done){
			if(mysql.query.restore){
				mysql.query.restore();
			}
			queryStub = sinon.stub(mysql, 'query')
			queryStub.callsArgWith(2, null, [{active: 1, id: 1}]);
			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password',
					// remember_me: true
				})
				.expect(200)
				.end(function(err, res) {

					if (err) {
						return done(err);
					}

					sessionCookie = res.headers['set-cookie'][0];
					mysql.query.restore()
					done()
				})			
		})

		beforeEach(function(){
			queryStub = sinon.stub(mysql, 'query')
		})	
		afterEach(function(){
			mysql.query.restore()
		})				
		it('200', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1, roles: 'roleB,roleA'}]);			
			request(server.app)
				.get('/roleA')
				.set('cookie', sessionCookie)
				.expect(200, done)
		});

		// it('200 miss then match', function(done) {
		// 	queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1, roles: 'roleB,roleA'}]);		
		// 	request(server.app)
		// 		.get('/roleBorC')
		// 		.set('cookie', sessionCookie)
		// 		.expect(200, done)
		// });

		it('401 incorrect roles', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1, roles: 'roleB,roleA'}]);					
			request(server.app)
				.get('/roleC')
				.set('cookie', sessionCookie)
				.expect(403, done)
		});

		it('401 no user roles', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1}]);		
			request(server.app)
				.get('/noRoles')
				.set('cookie', sessionCookie)
				.expect(403, done)
		})

		it('wrapper denied', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1, roles: 'roleB,roleA'}]);		
			var testVal = 'denied'
			server.get(
				'/checkRolesWrapperDenied',
				server.checkRolesWrapper.bind(server, ['roleC'], function(req, res, next) {
					testVal = 'allowed'
					next();
				}),
				function(req, res) {
					res.end(testVal)
				}
			);
			request(server.app)
				.get('/checkRolesWrapperDenied')
				.set('cookie', sessionCookie)
				.expect(200)
				.expect('denied', done)

		});

		it('wrapper allowed', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1, roles: 'roleB,roleA'}]);			
			var testVal = 'denied'
			server.get(
				'/checkRolesWrapperAllowed',
				server.checkRolesWrapper.bind(server, ['roleA'], function(req, res, next) {
					testVal = 'allowed'
					next();
				}),
				function(req, res) {
					res.end(testVal)
				}
			);
			request(server.app)
				.get('/checkRolesWrapperAllowed')
				.set('cookie', sessionCookie)
				.expect(200)
				.expect('allowed', done)

		})

	})

	describe('logout', function() {

		var headers;

		it('get redirected to /', function(done) {
			request(server.app)
				.get('/logout')
				.set('cookie', sessionCookie)
				.expect(302)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}
					headers = res.headers;
					done();
				});
		});

		it('got empty session cookie', function() {
			assert(headers['set-cookie'][0].indexOf(server.sessionCookieLabel + '=;') > -1)
		});

		it('no longer authenticated', function(done) {
			request(server.app)
				.get('/authenticated')
				.set('cookie', sessionCookie)
				.expect(401, done)
		})
	});

	describe('remember me', function() {

		var _server = server.serviceScaff();
		var queryStub;
		beforeEach(function(){
			if(mysql.query.restore){
				mysql.query.restore()
			}
			queryStub = sinon.stub(mysql, 'query')
		})

		before(function() {

			_server
				.redis(fakeredis.createClient('test'))
				.mysql(mysql)
				.web();

			// _server.deserializeUser = function(string, cb) {
			// 	var user;
			// 	if (string == 1) {
			// 		user = {
			// 			username: 'user',
			// 			id: 1
			// 		};
			// 	}
			// 	return cb(null, user)
			// }

			_server.app.post('/login', _server.login.bind(_server));
			_server.app.get('/logout', _server.logout.bind(_server));

			// every route after this requires authentication
			_server.app.use(server.authenticated.bind(server));

			_server.app.get('/set', function(req, res) {
				req.session[req.query.key] = req.query.value;
				res.end();
			});
			_server.app.get('/', function(req, res) {
				return res.json({
					value: req.session ? req.session[req.query.key] : false
				});
			});

			_server.errorHandler();

		})

		it('login', function(done) {
			queryStub.onCall(0).callsArgWith(2, null, [{active: 1, id: 1}]);	
			request(_server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password',
					remember_me: true
				})
				.expect(200)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}
					assert(res.headers['set-cookie'][0]);
					assert(res.headers['set-cookie'][1]);

					rememberCookie = res.headers['set-cookie'][0];
					sessionCookie = res.headers['set-cookie'][1];
					done()
				})
		});

		it('remember_me cookie only', function(done) {
			request(_server.app)
				.get('/')
				.set('cookie', rememberCookie)
				.expect(200)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}
					assert.notEqual(res.headers['set-cookie'][0], rememberCookie);
					assert.notEqual(res.headers['set-cookie'][1], sessionCookie);
					rememberCookie = res.headers['set-cookie'][0];
					sessionCookie = res.headers['set-cookie'][1];

					done();
				})
		});

		it('remember_me and session cookies, previous session maintained', function(done) {
			queryStub.callsArgWith(2, null, [{active: 1, id: 1}]);	
			request(_server.app)
				.get('/set')
				.set('cookie', [sessionCookie, rememberCookie])
				.query({
					key: 'hey',
					value: 'there'
				})
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}

					request(_server.app)
						.get('/')
						.set('cookie', [sessionCookie, rememberCookie])
						.query({
							key: 'hey'
						})
						.expect(/"value":"there"/, done)

				})
		});

		it('logout', function(done) {
			queryStub.callsArgWith(2, null, [{active: 1, id: 1}]);	
			request(_server.app)
				.get('/logout')
				.set('cookie', [sessionCookie, rememberCookie])
				.expect(302)
				.expect('set-cookie', /sessionId=;/, done)

		});

		it('old cookies not good anymore', function(done) {
			request(_server.app)
				.get('/')
				.set('cookie', [sessionCookie, rememberCookie])
				.expect(401, done)
		});

		it('issueRememberMe error', function(done) {
			queryStub.callsArgWith(2, null, [{active: 1, id: 1}]);	
			_server.issueRememberMe = function(u, _done) {
				_done('issueRemeberMe error')
			};
			_server.app.set('dontPrintErrors', true)

			request(_server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password',
					remember_me: true
				})
				.expect(500, done)
		});

	})

	describe('jade', function() {
		var _server = server.serviceScaff();

		beforeEach(function() {
			_server = server.serviceScaff();
			_server.express();
		});

		it('error, no dir', function() {
			assert.throws(function() {
				_server.addJade();
			}, /dir required/);
		});

		it('error, bad dir', function() {
			assert.throws(function() {
				_server.addJade('./test/jade2');
			}, /no such file or dir/);
		});

		it('error, file instead of dir', function() {
			assert.throws(function() {
				_server.addJade('./test/jade/template.jade');
			}, /is not a dir/);
		});

		it('render template', function(done) {

			_server.addJade('./test/jade');
			_server.get('/', function(req, res) {
				res.render('template');
			});

			request(_server.app)
				.get('/')
				.expect(200, done);
		})

	});

	describe('static', function() {
		var _server = server.serviceScaff();
		// var _mochaHttp = mochaHttp.MochaHttpUtils();

		beforeEach(function() {
			_server = server.serviceScaff();
			_server.express();
			// _mochaHttp = mochaHttp.MochaHttpUtils();
		});

		it('error, no dir', function() {
			assert.throws(function() {
				_server.addStaticDir();
			}, /dir required/);
		});

		it('error, bad dir', function() {
			assert.throws(function() {
				_server.addStaticDir('./test/static3');
			}, /no such file or dir/);
		});

		it('error, file instead of dir', function() {
			assert.throws(function() {
				_server.addStaticDir('./test/static1/test.txt');
			}, /is not a dir/);
		});

		it('single path, default route', function(done) {

			_server.addStaticDir('./test/static1');

			request(_server.app)
				.get('/test.txt')
				.expect('{"hey": "there"}', done)
		});

		it('bad route in declaration, 404', function(done) {

			_server.addStaticDir('./test/static1', 'mounted');
			request(_server.app)
				.get('/mounted/test.txt')
				.expect(404, done)
		});

		it('single path, custom route', function(done) {

			_server.addStaticDir('./test/static1', '/mounted');
			request(_server.app)
				.get('/mounted/test.txt')
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					request(_server.app)
						.get('/test.txt')
						.expect(404, done)
				});
		});

		it('combo', function(done) {

			_server.addStaticDir('./test/static1', '/mounted');
			_server.addStaticDir('./test/static2');
			_server.addStaticDir('./test/jade', '/mounted');

			request(_server.app)
				.get('/mounted/test.txt')
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					request(_server.app)
						.get('/test2.txt')
						.expect(200)
						.end(function(err) {
							if (err) {
								return done(err);
							}
							request(_server.app)
								.get('/mounted/template.jade')
								.expect(200)
								.expect(/Jade is a terse/, done)
						})
				});
		});

	});

	describe('logger', function() {

		var _server = server.serviceScaff();
		_server.express();
		var spyStdout = sinon.spy(process.stdout, 'write');

		before(function() {

			_server.addQueryAndBodyParser();
			_server.addLogger();

			_server.get('/500', function(req, res) {
				res.status(500)
				res.end()
			})

			_server.get('/301', function(req, res) {
				res.status(301)
				res.end()
			})

			_server.get('/log', function(req, res) {
				res.end()
			})
			_server.post('/log', function(req, res) {
				res.end()
			})
		})

		it('get', function(done) {
			spyStdout.reset();
			request(_server.app)
				.get('/log')
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(1, spyStdout.callCount)
					done();
				})
		})
		it('get, noLog', function(done) {
			spyStdout.reset();
			request(_server.app)
				.get('/log')
				.query({
					noLog: 1
				})
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(0, spyStdout.callCount)
					done();
				})
		})

		it('post', function(done) {
			spyStdout.reset();
			request(_server.app)
				.post('/log')
				.expect(200)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(1, spyStdout.callCount)
					done();
				})
		});

		it('301', function(done) {
			spyStdout.reset();
			request(_server.app)
				.get('/301')
				.expect(301)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(1, spyStdout.callCount)
					done();
				});
		});

		it('500', function(done) {
			spyStdout.reset();
			request(_server.app)
				.get('/500')
				.expect(500)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(1, spyStdout.callCount)
					done();
				});
		});

		it('404', function(done) {
			spyStdout.reset();
			request(_server.app)
				.get('/404')
				.expect(404)
				.end(function(err) {
					if (err) {
						return done(err);
					}
					assert.equal(1, spyStdout.callCount)
					done();
				});
		});

		it('server.log', function() {
			spyStdout.reset();
			// _server.log('log message')
			_server.app.log('log message')
			assert.equal(1, spyStdout.callCount)
		})

	})

	describe('get/set', function() {
		var _server;
		beforeEach(function() {
			_server = server.serviceScaff();
		})

		it('get redis', function() {
			var r = server.redis()
			assert(r._events)
		})
		it('get mysql', function() {
			var r = server.mysql()
			assert(r.query)
		})

		it('redis client', function() {
			_server.redis(fakeredis.createClient('test'))
			var r = _server.redis()
			assert(r._events)
		})

		it('redis config', function(done) {
			_server.redis({
				port: 65534,
				host: '127.0.0.1',
				options: {
					max_attempts: 1
				}
			})
			_server.redis().once('error', function(err) {
				assert(err)
				done();
			});
		})

		it('mysql client', function() {
			_server.mysql(mysql)
			assert(_server.mysql()._events)
		})

		it('mysql config', function(done) {
			_server.mysql({
				port: 65534,
				host: '127.0.0.1'
			})
			var r = _server.mysql()
			assert(r._events)
			done();
		})

		it('rabbit get', function() {
			_server._wascally = 1;
			assert(_server.rabbit());
		})

		it('rabbit set', function(done) {

			_server.rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p',
				// timeout: 100,
				replyQueue: {
					name: 'replies',
					subscribe: 'true',
					durable: true
				},
			}, function() {
				_server._wascally.once('test.connection.failed', function(err) {
					assert.equal('No endpoints could be reached', err)
					done();
				});

			});
		});

		it('rabbit set 2', function(done) {

			_server.rabbit({
				connection: {
					name: 'test',
					server: 'host',
					port: '1',
					user: 'u',
					pass: 'p',
					// timeout: 100,
					replyQueue: {
						name: 'replies',
						subscribe: 'true',
						durable: true
					},
				}
			}, function(){
				assert(_server.rabbit().addQueue);	
				done()
			});
			
		});

	})

	describe('rabbit', function() {

		beforeEach(function(done) {
			// server._wascally = {
			// 	addExchange: function(){}
			// }

			server.rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p',
				prefix: 'version'
				// // timeout: 100,
				//    replyQueue: {
				//        name: 'replies',
				//        subscribe: 'true',
				//        durable: true
				//    },					
			}, function() {
				// server._wascally.once('test.connection.failed', function(err){
				// 	// assert.equal('No endpoints could be reached',err)
				server._wascally.connections = {
					'default': {
						createExchange: function() {},
						createQueue: function() {},
						createBinding: function() {
							var deferred = Q.defer();
							setTimeout(function() {
								deferred.resolve();
							}, 5)
							return deferred.promise;
						},
						channels: {
							'queue:send-rec.version.queue': {
								subscribe: function() {
								}
							},
							'queue:req-res.version.queue': {
								subscribe: function() {}
							}						

						}
					}
				}

				server._wascally.bindQueue = function() {
					var deferred = Q.defer();
					setTimeout(function() {
						deferred.resolve();
					}, 5)
					return deferred.promise;
				}

				server._wascally.addExchange = function() {
					var deferred = Q.defer();
					setTimeout(function() {
						deferred.resolve();
					}, 5)
					return deferred.promise;
				}
				done();
				// });

			});
		})

		it('rabbitRequest inherits', function(done) {

			var _server = server.serviceScaff();
			_server.rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p'
			});

			_server._wascally.request = function(ex, config) {
				assert.equal('req-res.default-exchange', ex)
				assert.equal('default.queue', config.routingKey)
				assert.equal('req-res.default.queue', config.type)
				assert.deepEqual({
					test: true
				}, config.body)
				done();
			};

			_server.rabbitRequest( 'queue', {
				test: true
			})

		});

		it('rabbitRequest', function(done) {
			var stub = sinon.stub(Rabbus, 'Requester', function(r, config) {
				var p = 'version'
				// if(stub.callCount > 1){
				// 	p = 'default';
				// }
				assert.equal('req-res.' + p + '-exchange', config.exchange)
				assert.equal(p + '.queue', config.routingKey)
				assert.equal('req-res.' + p + '.queue', config.messageType)
				return {
					request: function(msg, cb) {
						assert.equal(msg.test, true)
						assert(typeof cb === 'function')
						cb(null, {
							response: true
						})
					},
					exchange: 'test-exchange'
				}
			});

			server.rabbitRequest( 'queue', {
				test: true
			}, function(err, response) {
				if(err){
					return done(err)
				}

				assert.equal(response.response, true);

				// delete server._rabbitConfig.connection.prefix				

				server.rabbitRequest('queue', {
					test: true
				}, function(err, response) {
					if(err){
						return done(err)
					}					
					assert.equal(response.response, true);
					sinon.assert.calledOnce(stub)
					Rabbus.Requester.restore();
					// server._rabbitConfig.connection.prefix = 'version'
					done();
				})

			})

		});

		it('rabbitRespond inherits', function(done) {

			function handler(msg) {
				assert.equal(spy.callCount, 1);
				assert.deepEqual(msg, {
					incoming: true
				})
				Rabbus.Responder.restore();
				done();
			}

           sinon.stub(
                   server._wascally.connections.default.channels['queue:req-res.version.queue'],
                   'subscribe',
                   function() {
                           handler({
                                   incoming: true
                           }, function() {})
                   });

			var spy = sinon.spy(Rabbus, 'Responder');
			server.rabbitRespond('queue', 2, handler);
		});
		it('rabbitRespond', function(done) {
			var stub = sinon.stub(Rabbus, 'Responder', function(r, config) {
				var p = 'default';
				assert.equal('req-res.' + p + '-exchange', config.exchange)
				assert.equal(p + '.queue', config.routingKey)
				assert.equal('req-res.'  + p +'.queue', config.messageType)
				assert.deepEqual({
					name: 'req-res.' + p + '.queue',
					limit: 2
				}, config.queue)

				return {
					handle: function(cb) {
						cb(null, {
							response: true
						})
					},
					exchange: 'test-exchange'
				}
			});

			delete server._rabbitConfig.connection.prefix;

			server.rabbitRespond( 'queue', 2, function(err, response) {
				if(err){
					return done(err)
				}				
				assert.equal(response.response, true);
				sinon.assert.calledOnce(stub)
				Rabbus.Responder.restore();
				server._rabbitConfig.connection.prefix = 'version'
				done();
			});

		});
		it('rabbitRespond non number limit', function(done) {
			var stub = sinon.stub(Rabbus, 'Responder', function(r, config) {
				assert.equal('req-res.version-exchange', config.exchange)
				assert.equal('version.queue', config.routingKey)
				assert.equal('req-res.version.queue', config.messageType)
				assert.deepEqual({
					name: 'req-res.version.queue',
					limit: 1
				}, config.queue)

				return {
					handle: function(cb) {
						cb(null, {
							response: true
						})
					},
					exchange: 'test-exchange'
				}
			});
			server.rabbitRespond('queue', 'string', function(err, response) {
				if(err){
					return done(err)
				}				
				assert.equal(response.response, true);
				sinon.assert.calledOnce(stub)
				Rabbus.Responder.restore();
				done();
			});

		});

		it('rabbitSend via app', function(done) {

			var _server = server.serviceScaff();
			_server.express().rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p'
			});

			sinon.stub(_server._wascally, 'publish', function(ex) {
				var p = 'default'
				assert.equal('send-rec.' + p +'-exchange', ex)
				_server._wascally.publish.restore();
				done();
			});

			_server.app.rabbitSend( 'queue', {
				test: true
			});			
		});

		it('rabbitSend version', function(done) {

			var _server = server.serviceScaff();
			_server.rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p'
			});

			sinon.stub(_server._wascally, 'publish', function(ex) {
				var p = 'default'
				assert.equal('send-rec.' + p +'-exchange', ex)
				_server._wascally.publish.restore();
				done();
			});

			_server.rabbitSend( 'queue', {
				test: true
			});			
		});

		it('rabbitSend inherits', function(done) {

			var stub = sinon.stub(server._wascally, 'publish', function(ex, config) {
				var p = 'version'
				// if(stub.callCount > 1){
				// 	p = 'default';
				// }
				assert.equal('send-rec.' + p +'-exchange', ex)
				assert.equal( p +'.queue', config.routingKey)
				assert.equal('send-rec.' + p + '.queue', config.type)
				assert.deepEqual({
					test: true
				}, config.body)
				var deferred = Q.defer();
				setTimeout(function() {
					deferred.resolve();
				}, 5)
				return deferred.promise;
			});


			var spy = sinon.spy(Rabbus, 'Sender');

			

			server.rabbitSend( 'queue', {
				test: true
			}, function(err) {
				assert(!err);
	
				// delete server._rabbitConfig.connection.prefix

				server.rabbitSend('queue', {
					test: true
				}, function(err) {
					assert(!err)
					sinon.assert.calledTwice(stub)
					assert.equal(spy.callCount, 1)
					Rabbus.Sender.restore();
					server._wascally.publish.restore();
					// server._rabbitConfig.connection.prefix = 'version'
					done();
				})

			})
		});


		it('rabbitReceive default version', function(done) {

			var _server = server.serviceScaff();
			_server.rabbit({
				name: 'test',
				server: 'host',
				port: '1',
				user: 'u',
				pass: 'p'
			});
			sinon.stub(Rabbus, 'Receiver', function(r, config) {
				assert.deepEqual({
					name: 'send-rec.default.queue',
					limit: 1
				}, config.queue)

				Rabbus.Receiver.restore();
				done();

				return {
					receive: function() {},
				}

			});
			_server.rabbitReceive('queue', 'string');
		});


		it('rabbitReceive inherits', function(done) {

			function handler(msg) {
				assert.equal(spy.callCount, 1);
				assert.deepEqual(msg, {
					incoming: true
				})
				Rabbus.Receiver.restore();
				done();
			}

			sinon.stub(
				server._wascally.connections.default.channels['queue:send-rec.version.queue'],
				'subscribe',
				function() {
					handler({
						incoming: true
					}, function() {})
				});

			var spy = sinon.spy(Rabbus, 'Receiver');
			server.rabbitReceive('queue', 2, handler);
		});

		it('rabbitReceive non number limit', function(done) {
			var stub = sinon.stub(Rabbus, 'Receiver', function(r, config) {
				assert.deepEqual({
					name: 'send-rec.version.queue',
					limit: 1
				}, config.queue)
				return {
					receive: function(cb) {
						cb(null)
					},
					exchange: 'test-exchange'
				}
			});
			server.rabbitReceive('queue', 'string', function(err) {
				assert(!err)
				sinon.assert.calledOnce(stub)
				Rabbus.Receiver.restore();
				done();
			});

		});

	})

	function routes(_localServer) {

		// _localServer.deserializeUser = function(string, cb) {
		// 	var user;
		// 	if (string == 1) {
		// 		user = {
		// 			username: 'user',
		// 			id: 1
		// 		};
		// 	}
		// 	return cb(null, user)
		// }
		// 

		_localServer.authenticationLogin(function(req, u, p, cb) {
			if (u === 'user' && p === 'password') {
				return cb(null, {
					id: 1
				});
			} else {
				return cb(null, null, {
					message: 'bad credentials'
				});
			}
		});
		_localServer.authenticationApikey(function(req, key, cb) {
			if (key === '123') {
				return cb(null, {
					id: 1
				});
			} else {
				return cb(null, null, {
					message: 'bad credentials'
				});
			}
		});

		_localServer.get('/', function(req, res) {
			return res.json({
				'hey': 'there'
			})
		});

		_localServer.get('/check-session', function(req, res) {
			return res.json({
				value: req.session ? req.session[req.query.key] : false
			});
		});
		_localServer.get('/set-session', function(req, res) {
			req.session[req.query.key] = req.query.value
			return res.end();
		});

		_localServer.get('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})
		_localServer.post('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})

		// https://github.com/strongloop/express/issues/782
		_localServer.post('/login', _localServer.login.bind(_localServer));
		_localServer.get('/logout', _localServer.logout.bind(_localServer));

		// every route after this requires authentication
		_localServer.use(_localServer.authenticated.bind(_localServer));

		_localServer.get('/authenticated', function(req, res) {
			res.status(401);
			var count = 1;
			if (req.isAuthenticated() || req.user) {
				res.status(200);
			}
			if (req.session) {
				if (!req.session.requestCount) {
					req.session.requestCount = 1;
				} else {
					req.session.requestCount++;
				}
				count = req.session.requestCount
			}

			res.json({
				requestCount: count,
				user: req.user.username
			})
		})

		_localServer.get(
			'/roleA',
			_localServer.checkRoles.bind(_localServer, ['roleX', 'roleA']),
			function(req, res) {
				res.end()
			}
		)
		_localServer.get(
			'/roleC',
			_localServer.checkRoles.bind(_localServer, ['roleX', 'roleC']),
			function(req, res) {
				res.end()
			}
		)

		_localServer.get(
			'/roleBorC',
			_localServer.checkRoles.bind(_localServer, ['roleB', 'roleC']),
			function(req, res) {
				res.end()
			}
		)

		_localServer.get(
			'/noRoles',
			function(req, res, next) {
				delete req.user.roles
				next();
			},
			_localServer.checkRoles.bind(_localServer, ['roleB', 'roleC']),
			function(req, res) {
				res.end()
			}
		)
		_localServer.get(
			'/rolesNoUser',
			function(req, res, next) {
				delete req.user
				next();
			},
			_localServer.checkRoles.bind(_localServer, ['roleB', 'roleC']),
			function(req, res) {
				res.end()
			}
		)

	}

	function fakemysql() {
		var _mysql = {
			_events: 'fake events',
			query: function(q, p, cb) {

				// console.info(arguments);
				if (
					q === 'select id, active from users where username = ?' && p && p[0] === 'user1'
				) {
					return cb(null, [])
				}
				if (
					q === 'select id, active from users where username = ?' && p && p[0] === 'error'
				) {
					return cb('mysql fakeerror')
				}

				if (
					q === 'select id, active from users where username = ?' && p && p[0] === 'inactive'
				) {
					return cb(null, [{
						id: 1,
						password: 'password',
						salted: 0,
						active: 0,
						username: 'inactive'
					}])
				}

				if (
					q === 'select id, active from users where username = ?' && p && p[0] === 'salted'
				) {
					return cb(null, [{
						id: 1,
						password: 'salted',
						salted: 1,
						active: 1,
						username: 'salted'
					}])
				}

				if (
					q === 'select id, active from users where username = ?' && p && p[0] === 'salted2'
				) {
					return cb(null, [{
						id: 1,
						// password: '273cd801a1c998e570f9440191514d15f6cfa247',
						password: '$2a$10$AQv.Vf5iH/tGMnfpUzWDOuPoTtLo6bjRdawqdzopTmOsDH6JtzZ4G',
						salted: 1,
						active: 1,
						username: 'salted2'
					}])
				}

				if (
					q === 'select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?' && p && p[0] == '1234'
				) {
					return cb(null, [])
				}
				if (
					q === 'select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?' && p && p[0] == '123'
				) {
					return cb(null, [{
						id: 1
					}])
				}
				if (
					q === 'select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?' && p && p[0] == 'mysqlerr'
				) {
					return cb('mysql errir')
				}
				if (
					q === 'select u.id from  api_keys k join users u on (k.user_id = u.id) where apikey = ?' && p && p[0] == 'inactive'
				) {
					return cb(null, [{
						id: 10,
						active: 0
					}])
				}

				if (
					q === 'select id, active from users where username = ?' && p && p[0] == 'user'
				) {
					return cb(null, [{
						id: 1,
						password: 'password',
						salted: 0,
						active: 1
					}])
				}

				if (
					q === 'select * from users where username = ? and password = SHA1(?)' && p && p[0] == 'user' && p[1] == 'password'
				) {
					return cb(null, [{
						id: 1,
						password: 'password',
						salted: 0,
						active: 1,
						username: 'user'
					}])
				}

				if (
					q === 'select * from users where username = ?' && p && p[0] == 'salted2'
				) {
					return cb(null, [{
						id: 1,
						password: '$2a$10$AQv.Vf5iH/tGMnfpUzWDOuPoTtLo6bjRdawqdzopTmOsDH6JtzZ4G',
						salted: 1,
						active: 1,
						username: 'salted2'
					}])
				}

				if (
					q === 'select u.* , GROUP_CONCAT( role ) roles from users u  join user_roles r on(u.id=r.user_id)  where id = ? group by user_id' && p && p[0] == 1
				) {
					return cb(null, [{
						id: 1,
						password: 'password',
						salted: 0,
						active: 1,
						username: 'user',
						roles: 'roleB,roleA'
					}])
				}

				if (
					q === 'select * from users where id = ?' && p && p[0] == -1
				) {
					return cb('error')
				}

				cb('unknow query')
			}

		}
		return _mysql;
	}

}).call(this);