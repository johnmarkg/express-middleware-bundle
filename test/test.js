(function() {

	process.setMaxListeners(20)

	var request = require('supertest');

	var path = require('path');
	var sinon = require('sinon');

	var fakeredis = require('fakeredis');
	var mysql = fakemysql();

	var assert = require('assert');
	var server = require('../index');

	var sessionCookie;
	var rememberCookie;
	var cookieDomain = 'fakedomain.com'

	var spyError = sinon.spy(console, 'error');

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
		var _server;
		beforeEach(function() {
			_server = server.ExpressMiddlewareBundle();
			_server.set('dontPrintErrors', true)
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
				.end(function(err, res) {
					if(err){
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
				.end(function(err, res) {
					if(err){
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

		it('verifyPassword err', function(done) {
			server.verifyPassword(1, 2, null, function(err) {
				assert(err)
				done();
			})
		})

		it('deserializeUser err', function(done) {
			server.deserializeUser(-1, function(err) {
				assert(err)
				done();
			})
		})
	});

	// describe('web, no redis or mysql', function() {
	// 	var _server = server.ExpressMiddlewareBundle();
	// 	// var _mochaHttp = mochaHttp.MochaHttpUtils();

	// 	_server.web();

	// })



	describe('messages/shutdown', function() {

		it('start cb', function(done) {
			
			var _server2 = server.ExpressMiddlewareBundle()
			_server2.start(0, function(){
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
			var _server2 = server.ExpressMiddlewareBundle()	
			_server2.start(0);
		});

		it('offline message', function(done) {


			var _server2 = server.ExpressMiddlewareBundle()

			_server2.start(0, function(){
				process.send = function(msg) {
					assert(msg, 'offline')
					delete process.send;
					done();
				}				
				_server2.shutdown();								
			})

		});

		describe('shutdown', function(){

			var _server2 = server.ExpressMiddlewareBundle()
			// _server2.addLogger();
			_server2.app.get('/slow/:ms', function(req, res) {
				// console.info(req.params.ms)

				setTimeout(function() {
					return res.end()
				}, req.params.ms);
			});			
			_server2.shutdownTimeout = 600

			var _port;
			it('respond to pending request on shutdown', function(done){
				_server2.start(0, function(err, p){
					_port = p

					// request(_server2.server)
					// 	.get('/slow/1000')
					// 	.expect(500, done);


					request(_server2.server)
						.get('/slow/400')
						.expect(200, done);
						// .expect(200);

					setTimeout(function(){
						_server2.shutdown('shutdown message 2');								
					},20)

					setTimeout(function(){

						request('http://127.0.0.1:'+_port)
							.get('/slow/100')
							// .expect(200)
							.end(function(err, res){
								assert('ECONNREFUSED',err.code)
								// done();
							});
					},40)

				});

			});

			it('stop accepting new connections', function(done){
				request('http://127.0.0.1:'+_port)
					.get('/slow/100')

					.end(function(err, res){
						assert('ECONNREFUSED',err.code)
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

		before(function(){
			_server = server.ExpressMiddlewareBundle();
			_server.addGzip({
				threshold: 1,
			});
			_server.addGzip() // still works with extra call to addGzip
			_server.app.get('/', function(req, res, next) {
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
					if(res.headers['content-encoding']){
						return 'got content-encoding'
					}
					
				})
				.end(done);
		});

		it('not compressesed, threshold', function(done) {
			var _server = server.ExpressMiddlewareBundle();

			_server.addGzip();

			_server.app.get('/', function(req, res, next) {
				res.json({
					abc: 123
				});
			});

			request(_server.app)
				.get('/')
				.set('Accept-Encoding', 'gzip,deflate')
				.expect(200)
				.expect(function(res) {
					if(res.headers['content-encoding']){
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
					if(err){
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

			var _server = server.ExpressMiddlewareBundle();
			_server.addRedisSessions({
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
			request(server.app)
				.post('/authenticated')
				.query({
					apikey: 'mysqlerr'
				})
				.expect(401, done)
		});

		it('apikey, inactive', function(done) {
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: 'inactive'
				})
				.expect(401)
				.expect(/not active/, done)
		});

		it('bad apikey', function(done) {
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '1234'
				})
				.expect(401, done)
		});

		it('apikey, no session', function(done) {

			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '123'
				})
				.expect(200)
				.end(function(err, res) {
					if(err){
						return done(err);
					}
					request(server.app)
						.post('/authenticated')
						.set('cookie', res.headers['set-cookie'][0])
						.expect(401, done)
				});
		});

		it('apikey, deserialize fail', function(done) {
			server.deserializeUser = function(uid, cb){
				cb(new Error('deserializeError'))
			}
			request(server.app)
				.get('/authenticated')
				.query({
					apikey: '123'
				})
				.expect(500)
				.expect(/deserializeError/, done)
		});




		it('loginFn mysql error', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: 'error',
					password: 'password'
				})
				.expect(500, done)
		});

		it('login inactive user', function(done) {
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

		it('salted password fail', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: 'salted',
					password: 'salted'
				})
				.expect(401)
				.expect(/"success":false/)
				.expect(/password/, done)
		});

		it('salted password success', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: 'salted2',
					password: 'salted'
				})
				.expect(200, done)
		});

		it('login success', function(done) {
			request(server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password'
				})
				.expect(200)
				.end(function(err, res) {
					if(err){ return done(err); }

					sessionCookie = res.headers['set-cookie'][0]
					request(server.app)
						.get('/authenticated')
						.set('cookie', sessionCookie)
						.expect(200)
						.expect(/"user":"user"/, done)
				});
		});

		it('cross process, different session secret', function(done) {
			var _server = server.ExpressMiddlewareBundle();
			_server.addRedisSessions({
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


	describe('api', function(){
		// var _server = server.ExpressMiddlewareBundle();
		// _server
		// 	// .redis(fakeredis.createClient('test'))
		// 	// .mysql(mysql)
		// 	// .cookieConfig({
		// 	// 	domain: cookieDomain
		// 	// })
		// 	.api();		
			
		// // routes(_server);
		// _server.post('/login', _server.login.bind(_server));
		// _server.use(_server.authenticated.bind(_server));
		// _server.get('/authenticated', function(req, res, next){
		// 	res.end();
		// });
		// _server.errorHandler();

		// _server.app.set('dontPrintErrors', true)

		it('requires redis', function(){
			var _server = server.ExpressMiddlewareBundle();

			assert.throws(function(){
				_server.api();
			}, /redis/)
			
			assert.doesNotThrow(function(){
				_server.redis(fakeredis.createClient('test'))
				_server.api();
			})

		})

		it('default auth fails with no mysql', function(done){
			var _server = server.ExpressMiddlewareBundle();			
			_server.redis(fakeredis.createClient('test'))
			_server.api();
			_server.use(_server.authenticated.bind(_server));
			_server.get('/authenticated', function(req, res, next){
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
			var _server = server.ExpressMiddlewareBundle();
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

		it('cookies work', function(done){

			var _server = server.ExpressMiddlewareBundle();
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
			_server.get('/authenticated', function(req, res, next){
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
				.end(function(err, res){
					if(err){
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
		it('200', function(done) {
			request(server.app)
				.get('/roleA')
				.set('cookie', sessionCookie)
				.expect(200, done)
		});

		it('200 miss then match', function(done) {
			request(server.app)
				.get('/roleBorC')
				.set('cookie', sessionCookie)
				.expect(200, done)
		});

		it('401 incorrect roles', function(done) {
			request(server.app)
				.get('/roleC')
				.set('cookie', sessionCookie)
				.expect(403, done)
		});
		
		it('401 no user roles', function(done) {
			request(server.app)
				.get('/noRoles')
				.set('cookie', sessionCookie)
				.expect(403, done)
		})

		it('401 no user', function(done) {
			request(server.app)
				.get('/rolesNoUser')
				.set('cookie', sessionCookie)
				.expect(403, done)
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
					if(err){
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

		var _server = server.ExpressMiddlewareBundle();

		before(function() {

			_server
				.redis(fakeredis.createClient('test'))
				.mysql(mysql)
				.web();

			_server.deserializeUser = function(string, cb) {
				var user;
				if (string == 1) {
					user = {
						username: 'user',
						id: 1
					};
				}
				return cb(null, user)
			}

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
			request(_server.app)
				.post('/login')
				.send({
					username: 'user',
					password: 'password',
					remember_me: true
				})
				.expect(200)
				.end(function(err, res) {
					if(err){
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
					if(err){
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

			request(_server.app)
				.get('/set')
				.set('cookie', [sessionCookie, rememberCookie])
				.query({
					key: 'hey',
					value: 'there'
				})
				.expect(200)
				.end(function(err, res) {
					if(err){
						return done(err);
					}					
					// assert.notEqual(res.headers['set-cookie'][0], rememberCookie);
					// assert.notEqual(res.headers['set-cookie'][1], sessionCookie);
					// rememberCookie = res.headers['set-cookie'][0];
					// sessionCookie = res.headers['set-cookie'][1];
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
			request(_server.app)
				.get('/logout')
				.set('cookie', [sessionCookie, rememberCookie])
				.expect(302)
				.expect('set-cookie', /sessionId=;/)
				.expect('set-cookie', /rememberMe=;/, done)

		});

		it('old cookies not good anymore', function(done) {
			request(_server.app)
				.get('/')
				.set('cookie', [sessionCookie, rememberCookie])
				.expect(401, done)
		});

		it('issueRememberMe error', function(done) {

			_server.issueRememberMe = function(u, _done){	
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
		var _server = server.ExpressMiddlewareBundle();

		beforeEach(function() {
			_server = server.ExpressMiddlewareBundle();
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
		var _server = server.ExpressMiddlewareBundle();
		// var _mochaHttp = mochaHttp.MochaHttpUtils();

		beforeEach(function() {
			_server = server.ExpressMiddlewareBundle();
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
				.end(function(err, res) {
					if(err){
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
				.end(function(err, res) {
					if(err){
						return done(err);
					}					
					request(_server.app)
						.get('/test2.txt')
						.expect(200)
						.end(function(err, res) {
							if(err){
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

	describe('logger', function(){

		var _server = server.ExpressMiddlewareBundle();
		var spyStdout = sinon.spy(process.stdout, 'write');

		before(function(){

			_server.addQueryAndBodyParser();
			_server.addLogger();

			_server.get('/500', function(req, res){
				res.status(500)
				res.end()
			})

			_server.get('/301', function(req, res){
				res.status(301)
				res.end()
			})

			_server.get('/log', function(req, res){
				res.end()
			})
			_server.post('/log', function(req, res){
				res.end()
			})			
		})
		
		it('get', function(done){
			spyStdout.reset();
			request(_server.app)
				.get('/log')
				.expect(200)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(1,spyStdout.callCount)
					done();
				})
		})
		it('get, noLog', function(done){
			spyStdout.reset();
			request(_server.app)
				.get('/log')
				.query({noLog: 1})
				.expect(200)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(0,spyStdout.callCount)
					done();
				})
		})


		it('post', function(done){
			spyStdout.reset();
			request(_server.app)
				.post('/log')
				.expect(200)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(1,spyStdout.callCount)
					done();
				})
		});

		it('301', function(done){
			spyStdout.reset();
			request(_server.app)
				.get('/301')
				.expect(301)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(1,spyStdout.callCount)
					done();
				});
		});

		it('500', function(done){
			spyStdout.reset();
			request(_server.app)
				.get('/500')
				.expect(500)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(1,spyStdout.callCount)
					done();
				});
		});

		it('404', function(done){
			spyStdout.reset();
			request(_server.app)
				.get('/404')
				.expect(404)
				.end(function(err){
					if(err){
						return done(err);
					}
					assert.equal(1,spyStdout.callCount)
					done();
				});
		});		

		it('server.log', function(){
			spyStdout.reset();
			_server.log('log message')
			assert.equal(1,spyStdout.callCount)
		})


	})


	describe('get/set', function() {
		var _server;
		beforeEach(function(){
			_server = server.ExpressMiddlewareBundle();
		})
		
		it('get redis', function(){
			var r  = server.redis()
			assert(r._events)
		})
		it('get mysql', function(){
			var r  = server.mysql()
			assert(r.query)
		})		


		it('redis client', function(){
			_server.redis(fakeredis.createClient('test'))
			var r  = _server.redis()
			assert(r._events)			
		})

		it('redis config', function(done){
			_server.redis({port: 65534, host:'127.0.0.1', options:{max_attempts: 1} })	
			_server.redis().once('error', function(err){
				assert(err)
				done();
			});
		})	

		it('mysql client', function(){
			_server.mysql(mysql)
			assert(_server.mysql()._events)			
		})		

	

		it('mysql config', function(done){
			_server.mysql({port: 65534, host:'127.0.0.1'})	
			var r  = _server.mysql()
			assert(r._events)						
			done();
		})				

		it('rabbit get', function(){
			_server._rabbit = 1;
			assert(_server.rabbit() );
		})

		it('rabbit set', function(done){

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
				}, function(){
					_server._wascally.once('test.connection.failed', function(err){
						assert.equal('No endpoints could be reached',err)
						done();	
					});
					
				});
		});


		it('rabbit set 2', function(){

				_server.rabbit({connection: {
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
				}});
				assert(_server.rabbit().send);
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

		_localServer.get('/authenticated', function(req, res, next) {
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
			function(req, res, next){
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
			function(req, res, next){
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
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] === 'user1'
				) {
					return cb(null, [])
				}
				if (
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] === 'error'
				) {
					return cb('mysql fakeerror')
				}

				if (
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] === 'inactive'
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
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] === 'salted'
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
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] === 'salted2'
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
					q === 'select id, password, salted, active from users where username = ?' && p && p[0] == 'user'
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