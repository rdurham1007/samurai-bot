const xmpp = require('node-xmpp');
const request_helper = require('request');
const util = require('util');
const config = require('./config.js').settings;
const JabberClient = require('./jabber_client.js');
const moment = require('moment');
const amqp = require('amqp');

var KinkBot = function (settings) {	

	var client = null;
	var commands = {};
	
	//rabbitmq settings
	var exchange = null;
	var queueu = null;
	var rabbitConnection = null;
	
	var start = function()
	{
		startJabberClient();
	}
	
	var startJabberClient = function()
	{
		//start up our jabber client
		client = new JabberClient({
			jabber: settings,
			onlineCallback: botOnline,
			messageCallback: processMessage
		});
		
		client.connect();		
	}
	
	var subscribeToExchange = function() {
		
		rabbitConnection = amqp.createConnection({ 
			host: settings.rabbit.host
			, port: settings.rabbit.port
			, login: settings.rabbit.username
			, password: settings.rabbit.password
			, authMechanism: settings.rabbit.authMechanism
			, vhost: settings.rabbit.vhost
			, ssl: { enabled : settings.rabbit.ssl }
		});

		// Wait for connection to become established.
		rabbitConnection.on('ready', function () {
			
			util.log('Connected to the RabbitMQ server.');
			
			exchange = rabbitConnection.exchange('jabber-broadcast', {type: 'topic'}, function(exchange) {
			    
			    util.log('Exchange Ready!');			    
			    			
				//connect to our queue
				queue = rabbitConnection.queue('kinkbot-broadcast', function(q){
					
					q.bind(exchange, '#');
					util.log('Queue ready.');
					
					// Receive messages
					q.subscribe(function (message) {
						util.log(message.text);
						client.send_message(settings.broadcast_to, message.text, null);
					});
					
					//util.log('attempting to send message');
					//exchange.publish('#', { text: 'testing', from: 'TEST USER' }, { contentType: 'application/json' });
				});
			    
			});

		});
	}
	
	var botOnline = function()
	{
		client.join_muc('alliance_hangout', 'Kinkbot');
		
		//we're connected to the xmpp server so start processing messages
		//that come in from the exchange
		subscribeToExchange();
	}
	
	var processMessage = function(msg)
	{
		var message_body = msg.body;
		
		if (message_body !== null) {
			commandMatch = message_body.match(settings.command_regex);
			
			if(commandMatch === null) return;
			
			var command = commandMatch[1];
			var args = "";

			if (commandMatch.length > 2)
				args = commandMatch[2];

			util.log("Command: " + command);
			util.log("Args: " + commandMatch);
			util.log("From: " + msg.from);

			if ('!help' === command || '!?' == command) {
				send_help_information(msg.from, msg.type);
			} else if (typeof message_body[1] !== "undefined") {
				client.send_message(msg.from, execute_command(command, args), msg.type);
			} else {
				client.send_unknown_command_message(command, msg.from, msg.type)
			}
			
		}
	}
	
	var add_command = function (command, callback) {
		commands[command] = callback;
	}

	var execute_command = function (command, args) {
		if (typeof commands[command] === "function") {
			return commands[command](args);
		}
		return command + 'is not a known command.';
	}

	var send_help_information = function (to_jid, msg_type) {
		var message_body = "\nI can help you with the following:\n";
		message_body += "!time - Relay the current eve time\n";
		message_body += "Usage: !time\n";
		client.send_message(to_jid, message_body, msg_type);
	}

	var send_unknown_command_message = function (command, jid, msg_type) {
		client.send_message(jid, 'Unknown command: "' + command + '". Send "!help" for more information.', msg_type);
	}

	add_command('!echo', function (args) {
		return args;
	});

	add_command('!time', function (args) {
		return 'Eve Time: ' + moment().utc().format('HH:mm:ss D MMMM YYYY');
	});
	
	return {
		start: start
	}

};

//This how we start up
var bot = new KinkBot(config);
bot.start();
