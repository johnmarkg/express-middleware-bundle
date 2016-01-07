(function () {

    var assert = require('assert')
    var request = require('supertest')
    var server = require('../index')([
        'static'
    ])
    server.express()

    describe('static', function () {
        var server

        beforeEach(function () {
            server = require('../index')([
                'static'
            ])
            server.express()
        });

        it('error, no dir', function () {
            assert.throws(function () {
                server.addStaticDir();
            }, /dir required/);
        });

        it('error, bad dir', function () {
            assert.throws(function () {
                server.addStaticDir(
                    './test/static3');
            }, /no such file or dir/);
        });

        it('error, file instead of dir', function () {
            assert.throws(function () {
                server.addStaticDir(
                    './test/static1/test.txt');
            }, /is not a dir/);
        });

        it('single path, default route', function (done) {

            server.addStaticDir('./test/static1');

            request(server.app)
                .get('/test.txt')
                .expect('{"hey": "there"}', done)
        });

        it('bad route in declaration, 404', function (done) {

            server.addStaticDir('./test/static1',
                'mounted');
            request(server.app)
                .get('/mounted/test.txt')
                .expect(404, done)
        });

        it('single path, custom route', function (done) {

            server.addStaticDir('./test/static1',
                '/mounted');
            request(server.app)
                .get('/mounted/test.txt')
                .expect(200)
                .end(function (err) {
                    if (err) {
                        return done(err);
                    }
                    request(server.app)
                        .get('/test.txt')
                        .expect(404, done)
                });
        });

        it('combo', function (done) {

            server.addStaticDir('./test/static1',
                '/mounted');
            server.addStaticDir('./test/static2');

            request(server.app)
                .get('/mounted/test.txt')
                .expect(200)
                .end(function (err) {
                    if (err) {
                        return done(err);
                    }
                    request(server.app)
                        .get('/test2.txt')
                        .expect(200, done)
                });
        });

        it('jade', function(done){

            assert.throws(function(){
                server.addJade();
            },/dir required/)
            assert.throws(function(){
                server.addJade('./nonexistentDir');
            })
            assert.throws(function(){
                server.addJade('./test/static.js');
            },/is not a directory/)

            server.addJade('./test/jade');
            server.get('/jade', function(req, res){
                res.render('template');
            })
            request(server.app)
                .get('/jade')
                .expect(200)
                .expect(/<p>Get on it!<\/p>/,done)
                // .end(function(err, res){
                //     console.info(res.text)
                //     done()
                // })

        })

    });

})()
