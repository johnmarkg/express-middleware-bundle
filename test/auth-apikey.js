(function () {

    var request = require('supertest')
    var sinon = require('sinon')
    var fakeredis = require('fakeredis')
    var assert = require('assert')

    describe('api', function () {

        var server

        before(function () {
            server = require('../index')([
            'resources/redis',
            'resources/mysql',
            'sessions',
            'auth',
            'auth/apikey',
            'middleware'
        ]);

            server.redis(fakeredis.createClient('test'))
            server.express();
            server.addRedisSessions()
            server.authenticationApikey()

            server.authenticated();
            server.get('/', function (req, res) {
                res.end()
            })
            server.use(function (err, req, res, next) {
                res.status(500)
                res.end(err.toString())
                if (next) {
                    next()
                }
            })
        })

        it('authenticationApikey called again', function(){
            assert.doesNotThrow(function(){
                server.authenticationApikey()
            })
        })

        it('no mysql', function(done){
            request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(500)
                .expect(/mysql required for api auth/, done)
        })

        it('default apiAuth, mysql error', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,'fakerror');
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(500)
                .expect(/fakerror/, done)
        })

        it('default apiAuth, user not found', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,null,[]);
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(401)
                .expect(/Unknown user/, done)
        })

        it('default apiAuth, user inactive', function(done){
            var queryStub = sinon.stub();
            queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 0}]);
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(401)
                .expect(/not active/, done)
        })

        it('default apiAuth, found user', function(done){

            var queryStub = sinon.stub();

            // apiAuth query
            queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
            // deserializeUser
            queryStub.onCall(1).callsArgWith(2,null,[{id: 1, active: 1}]);
            server.mysql({_events: true, query: queryStub})

            request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(200, done)

        })

        it('custom apiAuth', function(done){

            var queryStub = sinon.stub();

            // deserializeUser
            queryStub.onCall(0).callsArgWith(2,null,[{id: 1, active: 1}]);
            server.mysql({_events: true, query: queryStub})

			server.apiAuth = function(req, key,  cb){
				assert.equal(key, 123)
				// assert.equal(p, 'b')
				cb(null, {id: 1, active: 1})
			}

			request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(200, done)
        })


        it('custom apiAuth, user not found', function(done){

			server.apiAuth = function(req, key,  cb){
				assert.equal(key, 123)
				cb(null, false)

			}
			request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(401, done)
        })

        it('custom apiAuth, user not found with message', function(done){

			server.apiAuth = function(req, key,  cb){
				assert.equal(key, 123)
                return cb(null, false, {
                    message: 'test message'
                });

			}
			request(server.app)
                .get('/')
                .query({apikey: 123})
                .expect(/test message/)
                .expect(401, done)
        })

    })


})()
