(function() {

	var sinon = require('sinon');
	var fakeredis = require('fakeredis');

	var assert = require('assert');
	var server = require('../express-scaffold');
	var mochaHttp = require('mocha-http-utils');

	var sessionCookie;
	var rememberCookie;

	before(function(done) {
		server.addRedisSessions({
			client: fakeredis.createClient()
		});
		mochaHttp.openPort(function(err, port) {
			server.start(port, done)
			routes(server);
		});
	});

	describe('errors', function() {
		var _server;
		beforeEach(function() {
			_server = server.ExpressScaffold();
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

		it('authentication error' , function(done){
			var _mochaHttp = mochaHttp.MochaHttpUtils();
			
			_server.authenticationLogin(function(req, u, p, cb) {
				cb('authenticatibbbonLogin error');
			});			
			_server.deserializeUser = function(string, cb) {
				return cb('serialize error')
			}

			_server.addRedisSessions({client: fakeredis.createClient()});
			_server.app.post('/login', _server.login.bind(_server));
			_server.errorHandler();

			_mochaHttp.openPort(function(err, p){

				_server.start(p, function(){
					_mochaHttp.http({
						path: 'login',
						method:'post',
						json: true,
						body:{
							username: 'a',
							password: 'b'
						},
						status: 500
					}, done)					
				})
			})
		});

		it('req.login error' , function(done){
			var _mochaHttp = mochaHttp.MochaHttpUtils();
		
			_server.authenticationLogin(function(req, u, p, cb) {
				// console.info('authenticationLogin');
				cb(null, {id: 2});
			});			

			_server.addRedisSessions({client: fakeredis.createClient()});

			_server.app.post(
				'/login', 
				function(req, res, next){

					// console.info(req.login)
					req.login = function(user, req, cb){
						// console.info('my req.login')
						return cb(new Error('req.login error'))
					}
					next();
				},

				_server.login.bind(_server)
			);
			_server.errorHandler();



			_mochaHttp.openPort(function(err, p){

				_server.start(p, function(){
					_mochaHttp.http({
						path: 'login',
						method:'post',
						json: true,
						body:{
							username: 'a',
							password: 'b'
						},
						status: 500
					}, done)					
				})
			})
		});

	});

	describe('messages/shutdown', function() {
		var _server;
		var _mochaHttp = mochaHttp.MochaHttpUtils();

		after(function() {
			process.on('uncaughtException', originalException)
		})

		before(function() {
			originalException = process.listeners('uncaughtException').pop();
			process.removeListener('uncaughtException', originalException);
		})

		it('online', function(done) {

			process.send = function(msg) {
				assert(msg, 'online')
				delete process.send;
				done();
			}

			_mochaHttp.openPort(function(err, port) {
				_server = server.ExpressScaffold()
				_server.app.get('/slow', function(req, res) {
					setTimeout(function() {
						return res.end()
					}, 1000);
				});
				_server.start(port)
			});
		});

		it('offline', function(done) {
			process.send = function(msg) {
				assert(msg, 'offline')
				delete process.send;
			}

			_mochaHttp.http({
				path: 'slow'
			}, done)

			setTimeout(function() {
				_server.shutdown();
			}, 10)

		});

		it('accept no more requests', function(done) {

			var uncaughtListener = function(error) {
				assert.equal(error.code, 'ECONNREFUSED');
				done();
			}
			process.once("uncaughtException", uncaughtListener);

			_mochaHttp.http({
				path: 'slow'
			}, done)
		});

	});

	

	describe('gzip', function() {
		var _server = server.ExpressScaffold();
		var _mochaHttp = mochaHttp.MochaHttpUtils();

		// beforeEach(function(){
		// 	delete require.cache[require.resolve('compression')];			
		// })

		it('compressed', function(done) {
			var _server = server.ExpressScaffold();
			var _mochaHttp = mochaHttp.MochaHttpUtils();

			_server.addGzip({
				threshold: 1,
			});
			_server.app.get('/',function(req,res, next){
				res.json({abc: 123})
			})			

			_mochaHttp.openPort(function(err, port) {
				_server.start(port, function(){
					_mochaHttp.http({
						path: '',
						headers: {
							'Accept-Encoding': 'gzip'
						},
						resHeaders: {
							'content-encoding': 'gzip'
						},
					}, done)					
				})
			});
		});

		it('not compressesed, req headers', function(done) {
			var _server = server.ExpressScaffold();
			var _mochaHttp = mochaHttp.MochaHttpUtils();

			_server.addGzip({
				threshold: 1,
			});
			_server.app.get('/',function(req,res, next){
				res.json({abc: 123})
			})			

			_mochaHttp.openPort(function(err, port) {
				_server.start(port, function(){
					_mochaHttp.http({
						path: '',
						resHeaders: {
							'content-encoding': null
						},
					}, done)					
				})
			});			
		});	

		it('not compressesed, threshold', function(done) {
			var _server = server.ExpressScaffold();
			var _mochaHttp = mochaHttp.MochaHttpUtils();

			_server.addGzip();

			_server.app.get('/',function(req,res, next){
				res.json({abc: 123})
			})

			_mochaHttp.openPort(function(err, port) {
				_server.start(port, function(){
					_mochaHttp.http({
						path: '',
						headers: {
							'Accept-Encoding': 'gzip,deflate'
						},
						resHeaders: {
							'content-encoding': null
						},
					}, done)					
				})
			});
		});		
	});


	describe('query and body parser', function() {


		it('query', function(done) {
			mochaHttp.http({
				path: 'params',
				params: {
					param: 'hey',
					param2: 'hey2'
				},
				resJson: {
					'[0].param': 'hey',
					'[0].param2': 'hey2'
				}
			}, done)
		});

		it('body', function(done) {
			mochaHttp.http({
				path: 'params',
				method: 'post',
				body: {
					param: 'hey',
					param2: 'hey2'
				},
				json: true,
				resJson: {
					'[1].param': 'hey',
					'[1].param2': 'hey2'
				}
			}, done)
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
			mochaHttp.http({
				path: 'set-session',
				params: {
					key: 'started',
					value: 'yes'
				}
			}, function(err, res, body) {
				assert(res.headers['set-cookie'][0]);
				sessionCookie = res.headers['set-cookie'][0]
				done();
			})
		});

		it('check', function(done) {
			mochaHttp.http({
				path: 'check-session',
				headers: {
					'cookie': sessionCookie
				},
				params: {
					key: 'started'
				},
				resJson: {
					value: 'yes'
				}
			}, done)
		});

		it('cross process', function(done){
			var _mochaHttp = mochaHttp.MochaHttpUtils();

			_mochaHttp.openPort(function(err, port) {
				var _server = server.ExpressScaffold();
				_server.addRedisSessions({
					client: fakeredis.createClient()
				});

				_server.app.get('/check-session', function(req, res) {
					return res.json({
						value: req.session ? req.session[req.query.key] : false
					});
				});				

				_server.start(port, function(){
					mochaHttp.http({
						path: 'check-session',
						headers: {
							'cookie': sessionCookie
						},
						params: {
							key: 'started'
						},
						resJson: {
							value: 'yes'
						}
					}, done)
				})
			});			
		});



	});

	describe('authentication', function() {
		it('not yet', function(done) {
			mochaHttp.http({
				path: 'authenticated',
				status: 401
			}, function(err, res, body) {
				// console.info(body)
				// console.info(res.statusCode)
				done()
			})

		});

		it('missing username', function(done) {
			mochaHttp.http({
				path: 'login',
				method: 'post',
				json: true,
				body: {
					username: '',
					password: 'password'
				},
				resJson: {
					success: false,
					error: 'Missing credentials'
				},
				status: 401
			}, done)
		});

		it('missing password', function(done) {
			mochaHttp.http({
				path: 'login',
				method: 'post',
				json: true,
				body: {
					username: 'user',
					password: ''
				},
				resJson: {
					success: false,
					error: 'Missing credentials'
				},
				status: 401
			}, done)
		});

		it('failed login', function(done) {
			mochaHttp.http({
				path: 'login',
				method: 'post',
				json: true,
				body: {
					username: 'user1',
					password: 'password'
				},
				resJson: {
					success: false
				},
				status: 401
			}, done)
		});

		it('bad apikey', function(done) {
			mochaHttp.http({
				path: 'authenticated',
				params: {
					apikey: 1234
				},
				status: 401
			}, done)
		});	

		it('apikey, no session', function(done) {
			mochaHttp.http({
				path: 'authenticated',
				params: {
					apikey: 123
				},
				resJson: {
					// success: true,
					user: 'user'
				}				
			}, function(err, res, body){
				mochaHttp.http({
					path: 'authenticated',
					headers: {
						'cookie': res.headers['set-cookie'][0]
					},
					status: 401
				}, done);
			})
		});		

		it('login success', function(done) {
			mochaHttp.http({
				path: 'login',
				method: 'post',
				json: true,
				body: {
					username: 'user',
					password: 'password'
				},
				resJson: {
					success: true,
				},
			}, function(err, res, body) {
				assert(res.headers['set-cookie'][0]);
				sessionCookie = res.headers['set-cookie'][0]

				mochaHttp.http({
					path: 'authenticated',
					headers: {
						'cookie': sessionCookie
					},
					resJson: {
						// success: true,
						user: 'user'
					},					
				}, done);

			})
		});

		it('cross process, different session secret', function(done){
			var _mochaHttp = mochaHttp.MochaHttpUtils();

			_mochaHttp.openPort(function(err, port) {
				var _server = server.ExpressScaffold();
				_server.addRedisSessions({
					client: fakeredis.createClient()
				},{
					secret: 'different secret'
				});

				// every route after this requires authentication
				_server.app.use(server.authenticated.bind(server));

				_server.app.get('/', function(req, res) {
					return res.json({
						value: req.session ? req.session[req.query.key] : false
					});
				});				

				_server.start(port, function(){
					_mochaHttp.http({
						path: '',
						headers: {
							'cookie': sessionCookie
						},
						status: 401
					}, done)
				})
			});			
		});





		// it('logout, clear old session and start new one', function(done) {
		// 	mochaHttp.http({
		// 		headers: {
		// 			'cookie': sessionCookie
		// 		},
		// 		path: 'logout'
		// 	}, function(err, res, body) {

		// 		assert(res.headers['set-cookie'][0]);
		// 		var newSessionCookie = res.headers['set-cookie'][0]				
				
		// 		// neither session is authenticated
		// 		mochaHttp.http({
		// 			path: 'authenticated',
		// 			headers: {
		// 				'cookie': sessionCookie
		// 			},
		// 			status: 401
		// 		}, function(err, res, body){
		// 			mochaHttp.http({
		// 				path: 'authenticated',
		// 				headers: {
		// 					'cookie': newSessionCookie
		// 				},
		// 				status: 401
		// 			}, done);
		// 		})
		// 	});
		// });

		// it('verify old session was deleted on logout', function(done){
		// 	mochaHttp.http({
		// 		path: 'login',
		// 		method: 'post',
		// 		headers: {
		// 			'cookie': sessionCookie
		// 		},
		// 		json: true,
		// 		body: {
		// 			username: 'user',
		// 			password: 'password'
		// 		},
		// 		resJson: {
		// 			success: true
		// 		},
		// 	}, function(err, res, body) {
		// 		assert(res.headers['set-cookie'][0]);
		// 		sessionCookie = res.headers['set-cookie'][0]

		// 		mochaHttp.http({
		// 			path: 'authenticated',
		// 			headers: {
		// 				'cookie': sessionCookie
		// 			},
		// 			resJson:{
		// 				requestCount: 1
		// 			}

		// 		}, done);

		// 	})			
		// });


		// it('logout, clear old session and start new one', function(done) {
		// 	console.info(sessionCookie)
		// 	mochaHttp.http({
		// 		headers: {
		// 			'cookie': sessionCookie
		// 		},
		// 		path: 'logout'
		// 	}, function(err, res, body) {
		// 		console.info(res.headers)
				

		// 		assert(res.headers['set-cookie'][0]);
		// 		var newSessionCookie = res.headers['set-cookie'][0]				
				
		// 		// neither session is authenticated
		// 		mochaHttp.http({
		// 			path: 'authenticated',
		// 			headers: {
		// 				'cookie': sessionCookie
		// 			},
		// 			status: 401
		// 		}, done)
		// 	});
		// });




	});

	describe('logout', function(){
		it('redirect, cookie expiration', function(done){
			mochaHttp.http({
				headers: {
					'cookie': sessionCookie
				},
				path: 'logout',
				followRedirect: false,
				status: 302
			}, function(err, res, body){

				// got new cookie with very close expiration date
				assert(res.headers['set-cookie'][0]);
				var date = res.headers['set-cookie'][0].replace(/.*Expires=(.*?)\;.*/, "$1")
				date = new Date(date);
				assert(date.valueOf() <=  Date.now() + 1000)
				done();
			});
		});

		it('no longer authenticated', function(done){
			mochaHttp.http({
				path: 'authenticated',
				headers: {
					'cookie': sessionCookie
				},
				status: 401
			}, done)
		})
	});

	describe('remember me', function(){
		var _mochaHttp = mochaHttp.MochaHttpUtils();
		var _server = server.ExpressScaffold();
		before(function(done){
			_mochaHttp.openPort(function(err, port) {
				
				_server.addRedisSessions({
					client: fakeredis.createClient()
				});

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
				_server.authenticationLogin(function(req, u, p, cb) {
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

				var genToken = 1;
				_server.authenticationRememberMe(function verify(token, _done) {
					if(token == genToken){
						return _done(null, {
							id: 1
						});
					}
					_done();
				}, function issue(user, _done){
					_done(null, ++genToken);
				});

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

				_server.start(port, done);
			});				
		})



	

		it('login', function(done) {
			_mochaHttp.http({
				path: 'login',
				method: 'post',
				json: true,
				body: {
					username: 'user',
					password: 'password',
					remember_me: true
				}
			}, function(err, res, body) {
				// console.info(res.headers)
				assert(res.headers['set-cookie'][0]);
				assert(res.headers['set-cookie'][1]);
				rememberCookie = res.headers['set-cookie'][0];
				sessionCookie = res.headers['set-cookie'][1];
				done()

			})
		});

		it('remember_me cookie only', function(done){
			_mochaHttp.http({
				path: '',
				headers: {
					'cookie': rememberCookie
					// 'cookie': [sessionCookie, rememberCookie]
				}
			}, function(err, res, body){
				// console.info(res.headers);
				assert.notEqual(res.headers['set-cookie'][0], rememberCookie);
				assert.notEqual(res.headers['set-cookie'][1], sessionCookie);
				rememberCookie = res.headers['set-cookie'][0];
				sessionCookie = res.headers['set-cookie'][1];

				done();

			});
		});

		it('remember_me and session cookies, previous session maintained', function(done){
			_mochaHttp.http({
				path: 'set',
				params:{
					key: 'hey',
					value: 'there'
				},
				headers: {
					'cookie': [sessionCookie, rememberCookie]
				}
			}, function(err, res, body){

				_mochaHttp.http({
					path: '',
					params:{
						key: 'hey'
					},
					resJson:{
						value: 'there'
					},
					headers: {
						'cookie': [sessionCookie, rememberCookie]
					}
				}, done);

			});
		});		


		it('logout', function(done){

			_mochaHttp.http({
				headers: {
					'cookie': [sessionCookie, rememberCookie]
				},
				path: 'logout',
				followRedirect: false,
				status: 302
			}, function(err, res, body){
				// console.info(res.headers);
				done();
			});
		});		

		it('old session cookie not good anymore', function(done){
			_mochaHttp.http({
				path: '',
				headers: {
					// 'cookie': rememberCookie
					'cookie': [sessionCookie, rememberCookie]
				},
				status: 401
			}, done);
		});

		it('log back in with remember_me', function(done){
			_mochaHttp.http({
				path: '',
				headers: {
					'cookie': rememberCookie
					// 'cookie': [sessionCookie, rememberCookie]
				}
			}, function(err, res, body){
				// console.info(res.headers);
				assert.notEqual(res.headers['set-cookie'][0], rememberCookie);
				assert.notEqual(res.headers['set-cookie'][1], sessionCookie);
				rememberCookie = res.headers['set-cookie'][0];
				sessionCookie = res.headers['set-cookie'][1];

				done();

			});
		});


		it('previous session is gone', function(done){


				_mochaHttp.http({
					path: '',
					params:{
						key: 'hey'
					},
					resJson:{
						value: null
					},
					headers: {
						'cookie': [sessionCookie, rememberCookie]
					}
				}, done);

		});		





	})


	describe('static', function(){

	});

	function routes(server) {

		server.deserializeUser = function(string, cb) {
			var user;
			if (string == 1) {
				user = {
					username: 'user',
					id: 1
				};
			}
			return cb(null, user)
		}
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

		server.app.get('/', function(req, res) {
			return res.json({
				'hey': 'there'
			})
		});

		server.app.get('/check-session', function(req, res) {
			return res.json({
				value: req.session ? req.session[req.query.key] : false
			});
		});
		server.app.get('/set-session', function(req, res) {
			req.session[req.query.key] = req.query.value
			return res.end();
		});

		server.app.get('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})
		server.app.post('/params', function(req, res) {
			return res.json([req.query || {},
				req.body || {}]);
		})

		// https://github.com/strongloop/express/issues/782
		server.app.post('/login', server.login.bind(server));
		server.app.get('/logout', server.logout.bind(server));

		// every route after this requires authentication
		server.app.use(server.authenticated.bind(server));

		server.app.get('/authenticated', function(req, res, next) {
			res.status(401);
			// console.info(req.user)
			var count = 1;
			if (req.isAuthenticated() || req.user) {
				res.status(200);
			}
			if(req.session){
				if(!req.session.requestCount){
					req.session.requestCount = 1;
				}
				else{
					req.session.requestCount++;	
				}
				count = req.session.requestCount
			}


			
			res.json({requestCount: count, user: req.user.username })
		})
	}

}).call(this);