(function() {

	var assert = require('assert');
	var server = require('../index');


	describe('args', function(){
		it('default', function(){
			process.argv = [];
			var clArgs = server.commandLineArgs();
			assert(!clArgs.color)
			assert(!clArgs.port)
		});

		it('default --color', function(){
			process.argv = ['','','--color']
			var clArgs = server.commandLineArgs();
			assert(clArgs.color)
			assert(!clArgs.port)
		});

		it('default --port', function(){
			process.argv = ['','','--port', 123]
			var clArgs = server.commandLineArgs();
			assert(!clArgs.color)
			assert.equal(clArgs.port, 123)
		});

		it('add an integer option --int', function(){
			process.argv = ['','','--int', '123']
			var clArgs = server.commandLineArgs([{
				flag: '-i, --int [int]'
			}]);
			assert.equal(clArgs.int, 123)
		});

	})

}).call(this);	