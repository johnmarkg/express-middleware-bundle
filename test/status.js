(function() {

	// var sinon = require('sinon');
	var fakeredis = require('fakeredis');
	var assert = require('assert');
	var Server = require('../index');

	// describe('haveRedisClient', function(done){
	// 	it('no client using cb', function(){
	// 		var server = Server.serviceScaff();		
	// 		server.setStatus('key', 'field', 'val', function(err){
	// 			assert.equal(err.toString(), 'Error: no redis client set');
	// 		})
	// 	});
	// 	it('no client throws without cb', function(){
	// 		var server = Server.serviceScaff();		
	// 		assert.throws(function(){
	// 			server.setStatus('key', 'field', 'val')
	// 		},'no redis client set')

	// 	});	
	// });

	describe('setStatus', function(){
		it('no client using cb', function(done){
			var server = Server.serviceScaff();		
			server.setStatus('key', 'field', 'val', function(err){
				assert.equal(err.toString(), 'Error: no redis client set');
				done();
			})
		});
		it('no client throws without cb', function(){
			var server = Server.serviceScaff();		
			assert.throws(function(){
				server.setStatus('key', 'field', 'val')
			},'no redis client set')
		});	
		it('works', function(done){
			var server = Server.serviceScaff();		
			server.redis(fakeredis.createClient('test'))
			server.setStatus('key', 'field', 0, function(err){
				assert(!err);
				done();
			})
		});			
	});

	describe('getStatus', function(){
		it('no client using cb', function(done){
			var server = Server.serviceScaff();		
			server.getStatus('key', 'field', function(err){
				assert.equal(err.toString(), 'Error: no redis client set');
				done();
			})
		});
		it('no client throws without cb', function(){
			var server = Server.serviceScaff();		
			assert.throws(function(){
				server.getStatus('key', 'field');
			},'no redis client set')
		});	
		it('works', function(done){
			var server = Server.serviceScaff();		
			server.redis(fakeredis.createClient('test'))
			server.setStatus('key', 'field', 1, function(){
				server.getStatus('key', 'field', function(err, val){	
					assert(!err);
					assert.equal(val, 1)
					done()
				})
			});
		});			
	});	


	describe('getStatusAll', function(){
		it('no client using cb', function(done){
			var server = Server.serviceScaff();		
			server.getStatusAll('key', function(err){
				assert.equal(err.toString(), 'Error: no redis client set');
				done();
			})
		});
		it('no client throws without cb', function(){
			var server = Server.serviceScaff();		
			assert.throws(function(){
				server.getStatusAll('key');
			},'no redis client set')
		});	
		it('works', function(done){
			var server = Server.serviceScaff();		
			server.redis(fakeredis.createClient('test'))
			server.setStatus('key', 'field', 1, function(){
				server.setStatus('key', 'field2', 2, function(){
					server.getStatusAll('key', function(err, val){	
						assert(!err);
						// console.info(val)
						assert.deepEqual(val, { field: '1', field2: '2' })
						done();
					});
				})
			});
		});			
	});	

	describe('incrementStatus', function(){
		it('no client using cb', function(done){
			var server = Server.serviceScaff();		
			server.incrementStatus('key', 'field', 2,  function(err){
				assert.equal(err.toString(), 'Error: no redis client set');
				done();
			})
		});
		it('no client throws without cb', function(){
			var server = Server.serviceScaff();		
			assert.throws(function(){
				server.incrementStatus('key', 'field', 2);
			},'no redis client set')
		});	
		it('works', function(done){
			var server = Server.serviceScaff();		
			server.redis(fakeredis.createClient('test'))			
			server.setStatus('key', 'field10', 1, function(){
				server.incrementStatus('key', 'field10', 2, function(){
					server.getStatus('key', 'field10', function(err, val){	
						assert(!err);
						assert.equal(val, 3)
						done()
					})					
				});
			});
		})		
	})


}).call(this);