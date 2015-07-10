(function() {

	var sinon = require('sinon');
	var fakeredis = require('fakeredis');

	var assert = require('assert');
	var Server = require('../express-scaffold').ExpressScaffold;
	var mochaHttp = require('mocha-http-utils');

	var server = Server();

	before(function(done) {
		server.addGzip({ threshold: 1 });
		server.addQueryAndBodyParser();
		server.addRedisSessions({
			client: fakeredis.createClient()
		});			
		mochaHttp.openPort(function(err, port) {
			server.start(port, done)
			routes(server);
		});
	});


	describe('errors', function() {
		var _server = server.ExpressScaffold()

		it('no redis config', function() {
			assert.throws(function() {
				_server.addRedisSessions();
			})
		})
	});

	describe('messages/shutdown',function(){
		var _server;
		var _mochaHttp = mochaHttp.MochaHttpUtils();


    	after(function(){
    		process.on('uncaughtException',originalException)
    	})

		before(function(){
			originalException = process.listeners('uncaughtException').pop();
	        process.removeListener('uncaughtException', originalException);
		})

		it('online', function(done){

			process.send = function(msg){
				assert(msg, 'online')
				delete process.send;
				done();				
			}

			_mochaHttp.openPort(function(err, port) {
				_server = server.ExpressScaffold()
				_server.app.get('/slow', function(req, res) {
					setTimeout(function(){
						return res.end()
					},1000);
				});
				_server.start(port)
			});	
		});


		it('offline', function(done) {
			process.send = function(msg){
				assert(msg, 'offline')
				delete process.send;
			}

			_mochaHttp.http({
				path: 'slow'
			}, done)			

			setTimeout(function(){
				_server.shutdown();
			}, 10)
			
		});

		it('accept no more requests', function(done) {

			var uncaughtListener = function(error){
	            assert.equal(error.code, 'ECONNREFUSED');
	            done();
			}
			process.once("uncaughtException", uncaughtListener);

			_mochaHttp.http({
				path: 'slow'
			}, done)
		});

	});



		var sessionCookie

		describe('query and body parser', function() {
			it('gzip', function(done){
				mochaHttp.http({
					path: 'params',
					params: {
						param: 'hey',
						param2: 'hey2'
					},
					headers:{
						'Accept-Encoding': 'gzip,deflate'
					},
					resHeaders:{
						'content-encoding': 'gzip'
					},
				}, done)			
			});

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
		});

		describe('authentication', function() {
			it('not yet', function(done) {
				mochaHttp.http({
					path: 'authenticated',
					status: 401
				}, function(err, res, body){
					// console.info(body)
					// console.info(res.statusCode)
					done()
				})
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
			it('login', function(done) {
				mochaHttp.http({
					path: 'login',
					method: 'post',
					json: true,
					body: {
						username: 'user',
						password: 'password'
					},
					resJson: {
						success: true
					},
				}, function(err, res, body) {
					assert(res.headers['set-cookie'][0]);
					sessionCookie = res.headers['set-cookie'][0]

					mochaHttp.http({
						path: 'authenticated',
						headers: {
							'cookie': sessionCookie
						},
					}, done);

				})
			});

			it('logout', function(done) {
				mochaHttp.http({
					headers: {
						'cookie': sessionCookie
					},
					path: 'logout'
				}, function(err, res, body) {
					mochaHttp.http({
						path: 'authenticated',
						headers: {
							'cookie': sessionCookie
						},
						status: 401
					}, done)
				});
			});


			it('apikey', function(done) {
				mochaHttp.http({
					path: 'authenticated',
					params:{
						apikey: 123
					}
				}, function(err, res, body) {
					// console.info(body);
					// done()
					assert(res.headers['set-cookie'][0]);
					sessionCookie = res.headers['set-cookie'][0]

					mochaHttp.http({
						path: 'authenticated',
						headers: {
							'cookie': sessionCookie
						},
					}, done);

				})
			});

	})

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
			// console.info(key)
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
			return res.json([req.query || {}, req.body || {}]);
		})
		server.app.post('/params', function(req, res) {
			return res.json([req.query || {}, req.body || {}]);
		})


		// https://github.com/strongloop/express/issues/782
		server.app.post('/login', server.login.bind(server));
		server.app.get('/logout', server.logout.bind(server));


		// every route after this requires authentication
		server.app.use(server.authenticated.bind(server));

		server.app.get('/authenticated', function(req, res, next) {
			res.status(401);
			if (req.isAuthenticated()) {
				res.status(200);
			}

			res.end();
		})
	}

}).call(this);