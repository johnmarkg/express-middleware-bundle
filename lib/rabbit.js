(function(){
	'use strict';

	var util = require("util");
	var Rabbus = require("rabbus");
	var os = require("os");

	function Receiver(rabbus, version, label, limit) {
		var prefix = 'send-rec.';
		return Rabbus.Receiver.call(this, rabbus, {
			exchange: prefix + version + "-exchange",
			queue: {
				name: prefix + version + '.' + label ,
				limit: typeof limit === 'number' ? limit : 1
			},
			routingKey: version + '.' + label,
			messageType: prefix + version + '.' + label
		});
	}
	util.inherits(Receiver, Rabbus.Receiver);

	function Sender(rabbus, version, label) {
		var prefix = 'send-rec.';
		return Rabbus.Sender.call(this, rabbus, {
			exchange: prefix + version + "-exchange",
			routingKey: version + '.' + label,
			messageType: prefix + version + '.' + label
		});
	}
	util.inherits(Sender, Rabbus.Sender);

	function Responder(rabbus, version, label, limit) {
		var prefix = 'req-res.';
		return Rabbus.Responder.call(this, rabbus, {
			exchange: prefix + version + "-exchange",
			queue: {
				name: prefix + version + '.' + label ,
				limit: typeof limit === 'number' ? limit : 1
			},
			routingKey: version + '.' + label,
			messageType: prefix + version + '.' + label
		});
	}
	util.inherits(Responder, Rabbus.Responder);

	function Requester(rabbus, version, label) {
		var prefix = 'req-res.';

		return Rabbus.Requester.call(this, rabbus, {
			exchange: prefix + version + "-exchange",
			routingKey: version + '.' + label,
			messageType: prefix + version + '.' + label
		});
	}
	util.inherits(Requester, Rabbus.Requester);


	exports.rabbitRespond = function(queue, limit, handler){
		var version = this._rabbitConfig.connection.prefix || 'default'
		var responder = new Responder(this.rabbit(), version, queue, limit);
		responder.handle(handler);
	}
	exports.rabbitRequest = function(label, msg, cb){
		var version = this._rabbitConfig.connection.prefix || 'default'
		if(!this.requesters){
			this.requesters = {}
		}
		var key = version + '-' + label;
		if(!this.requesters[key]){
			this.requesters[key] = new Requester(
				this.rabbit(),
				version,
				label
			);
		}

		this.requesters[key].request(msg, cb);
	}


	exports.rabbitReceive = function(queue, limit, handler){
		var version = this._rabbitConfig.connection.prefix || 'default'
		var receiver = new Receiver(this.rabbit(), version, queue, limit);
		receiver.receive(handler);
	}
	exports.rabbitSend = function(label, msg, cb){
		var version = this._rabbitConfig.connection.prefix || 'default'
		if(!this.senders){
			this.senders = {}
		}
		var key = version + '-' + label;
		if(!this.senders[key]){
			this.senders[key] = new Sender(
				this.rabbit(),
				version,
				label
			);
		}

		this.senders[key].send(msg, cb);
	}

	exports.rabbitReplyQueue = function(label){
		if(this._config.rabbit){
			this._config.rabbit.replyQueue = replyQueue(label)
		}
		return this;
	}
	function replyQueue(label){
		if(!label){
			return null;
		}
		try {
			return 'z.reply-' + label + '-' + os.networkInterfaces()['eth0'][0].address + '-' + process.pid;
		} catch (err) {
			throw err
		}
	}



}).call(this);
