var assert = require('assert')
var server = require('../index')(['roles'])
var sinon = require('sinon')

describe('roles', function(){
    it('export', function(){
        assert.equal(typeof server.checkRoles , 'function')
        assert.equal(typeof server.checkRolesWrapper , 'function')
    })

    it('checkRoles', function(done){
        var fn = server.checkRoles(['c'])
        var req = {
            user: {
                roles: {
                    'c': true
                }
            }
        }

        fn(req, {}, function(){
            var res = {
                status: function(code){
                    assert.equal(code, 403)
                },
                end: function(msg){
                    assert.equal(msg, 'insufficient premissions')
                    done()
                }
            }

            fn({}, res)
        })
    })

    it('checkRolesWrapper', function(done){
        var stub = sinon.stub()
        stub.callsArgWith(2, 'hey')

        var fn = server.checkRolesWrapper(['c'], stub)

        var req = {
            user: {
                roles: {
                    'c': true
                }
            }
        }

        fn(req, {}, function(arg){

            assert.equal(arg, 'hey')

            fn({}, {}, function(){
                assert.equal(stub.callCount, 1)
                done()
            })
        })




    })
})
