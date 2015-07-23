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

	describe('web, no redis or mysql', function() {
		var _server = server.ExpressMiddlewareBundle();
		// var _mochaHttp = mochaHttp.MochaHttpUtils();

		_server.web();

	})

	describe('messages/shutdown', function() {
		var _server;

		after(function() {
			process.on('uncaughtException', originalException)
		})

		before(function() {
			originalException = process.listeners('uncaughtException').pop();
			process.removeListener('uncaughtException', originalException);

			_server = server.ExpressMiddlewareBundle()
			_server.app.get('/slow', function(req, res) {
				setTimeout(function() {
					return res.end()
				}, 1000);
			});
		})

		it('start cb', function(done) {
			
			var _server2 = server.ExpressMiddlewareBundle()
			_server2.start(0, function(){
				assert(true)
				done()
			})
		});

		it('online', function(done) {
			process.send = function(msg) {
				assert(msg, 'online')
				delete process.send;
				done();
			}
			_server.start(0)
		});

		it('offline', function(done) {
			process.send = function(msg) {
				assert(msg, 'offline')
				delete process.send;
			}

			request(_server.server)
				.get('/slow')
				.expect(200, done);

			setTimeout(function() {
				_server.shutdown();
			}, 100)

		});

		it('accept no more requests', function(done) {

			var uncaughtListener = function(error) {
				assert.equal(error.code, 'ECONNREFUSED');
				done();
			}
			process.once("uncaughtException", uncaughtListener);

			request(_server.server)
				.get('/slow')
				.expect(200, done);

		});
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

		it.skip('no session until something is set in req.session', function(done) {
			mochaHttp.http({
				path: 'set-session'
			}, function(err, res, body) {
				assert(!res.headers['set-cookie']);
				done();
			})
		});

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

	describe('checkRoles', function() {
		it('pass', function(done) {
			request(server.app)
				.get('/roleA')
				.set('cookie', sessionCookie)
				.expect(200, done)
		});

		it('pass2', function(done) {
			request(server.app)
				.get('/roleBorC')
				.set('cookie', sessionCookie)
				.expect(200, done)
		});

		it('fail', function(done) {
			request(server.app)
				.get('/roleC')
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


	})


	describe('get/set', function() {
		var _server;
		before(function(){
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

		it('mysql client', function(){
			_server.mysql(mysql)
			var r  = _server.mysql()
			assert(r._events)			
		})		

		it('redis config', function(done){
			_server.redis({port: 65534, host:'127.0.0.1'})	
			_server.redis().on('error', function(err){
				assert(err)
				done();
			});
		})		

		it('mysql config', function(done){
			_server.mysql({port: 65534, host:'127.0.0.1'})	
			var r  = _server.mysql()
			assert(r._events)						
			done();
		})				
	})

	function routes(server) {

		// server.deserializeUser = function(string, cb) {
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

		

		server.authenticationLogin(function(req, u, p, cb) {
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
		server.authenticationApikey(function(req, key, cb) {
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

		server.get('/', function(req, res) {
			return res.json({
				'hey': 'there'
			})
		});

		server.get('/check-session', function(req, res) {
			return res.json({
				value: req.session ? req.session[req.query.key] : false
			});
		});
		server.get('/set-session', function(req, res) {
			req.session[req.query.key] = req.query.value
			return res.end();
		});

		server.get('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})
		server.post('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})

		// https://github.com/strongloop/express/issues/782
		server.post('/login', server.login.bind(server));
		server.get('/logout', server.logout.bind(server));

		// every route after this requires authentication
		server.use(server.authenticated.bind(server));

		server.get('/authenticated', function(req, res, next) {
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

		server.get(
			'/roleA',
			server.checkRoles.bind(server, ['roleX', 'roleA']),
			function(req, res) {
				res.end()
			}
		)
		server.get(
			'/roleC',
			server.checkRoles.bind(server, ['roleX', 'roleC']),
			function(req, res) {
				res.end()
			}
		)

		server.get(
			'/roleBorC',
			server.checkRoles.bind(server, ['roleB', 'roleC']),
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