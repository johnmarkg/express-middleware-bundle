
(function() {

	var commander = require('commander');

	exports.commandLineArgs = function(options, version){

		if(typeof options == 'string' ){
			if(this.clArgs){
				return 	this.clArgs[options]
			}
			else{
				return undefined
			}
		}

		// get fresh object for unit tests
		this.clArgs = new commander.Command()

		if(version){
			this.clArgs.version(version)
		}

		processOptions(this.clArgs, options);

		this.clArgs.option('-p, --port [int]','port to listen on', parseInt)
		    .option('--color', 'force color log')
		    .parse(process.argv)

		return this
	}

	function processSubCommand(clArgs, o){
		var c = clArgs.command.apply(clArgs, o.command)

		if(o.options){
			o.options.forEach(function(_o){
				c.option.apply(c, _o)
			})
		}

		c.action(o.action)
	}

	function processOptions(clArgs, options){
		if(!options){ return; }

		options.forEach(function(o){

			if(!o){ return }

			if(o.command && o.action){
				processSubCommand(clArgs, o)
				return
			}

			if(o instanceof Array){
				clArgs.option.apply(clArgs, o);
				return
			}


			if(!o.flag){
				throw new Error('command line option requires flag: ' + JSON.stringify(o))
			}

			var args = [o.flag, o.description || '']
			if(typeof o.coercionFn === 'function'){
				args.push(o.coercionFn)
			}
			if(typeof o.defaultValue !== 'undefined'){
				args.push(o.defaultValue)
			}

			clArgs.option.apply(clArgs, args);

		})

	}

}.call(this));
