(function(){
    var assert = require('assert')
    var server = require('../index')(['config'])

    describe('config', function(){
        it('exported', function(){
            assert.equal(typeof server.config, 'function')
            assert.equal(typeof server.cookieConfig, 'function')
        })

        it('empty', function(){
            server.config()
            assert.deepEqual(server._config, {})
        })

        it('populate', function(){
            var obj = {
                key1: 1,
                key2: 2
            }
            server.config(obj)
            assert.deepEqual(server._config, obj)

            server.config('key', 'value')
            assert.equal(server.config('key'), 'value')
        })

        it('cookieConfig', function(){
            server.cookieConfig('a')
            assert.equal(server._cookieConfig, 'a')
        })
    })

})()
