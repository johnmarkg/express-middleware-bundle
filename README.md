Express bundled with Passport authentication, Redis sessions, morgan logs



## Usage

```
var server = require('express-middleware-bundle');

//------------------------------------
// set redis config for sessions, remember me authentication strategy
//------------------------------------
server.redis({
	//redis config
})

//------------------------------------
// set mysql config for local and api authentication stategies
//------------------------------------
server.mysql({
	// mysql config
})

//------------------------------------
// add auth (remember me, apikey, local) and session middleware
//------------------------------------
server.web()

//------------------------------------
// mount static assest to path 
//------------------------------------
server.addStaticDir('./css', 'static');
server.addStaticDir('./js', 'static');

//------------------------------------
// mount static assest to root
//------------------------------------
server.addStaticDir('./root');

//------------------------------------
// use jade templates from a dir
//------------------------------------
server.addJade('./jade');

//------------------------------------
// use built in login and logout handlers
//------------------------------------
server.post('/login', server.login.bind(server));
server.get('/logout', server.logout.bind(server));

//------------------------------------
// add routes that dont need authentication
//------------------------------------
server.get('nonauth-route', function(req,res,next){
	res.end('you are NOT authenticated')
})

//------------------------------------
// every route after this requires authentication
//------------------------------------
server.use(server.authenticated.bind(server));

server.get('auth-route', function(req,res,next){
	res.end('you are authenticated')	
})


server.start(port, function(){
	// server has started
})

```


Make a fresh server object:
```
var server2 = server.ExpressMiddlewareBundle();
```