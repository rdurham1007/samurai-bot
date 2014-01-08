// JavaScript Document

const xmpp = require('node-xmpp');
const request_helper = require('request');
const util = require('util');

var JabberClient = function (settings) {

	var conn = null;

	var connect = function() {
		
		//Open up our XMPP connection
		conn = new xmpp.Client(settings.jabber.client);
		
		conn.on('online', function () {
			set_status_message(settings.jabber.status_message);
			
			if(typeof settings.onlineCallback === 'function')
			{
				settings.onlineCallback();
			}
			
		});
		
		conn.on('stanza', function (stanza) {
			util.log(stanza);
	
			//subscription request
			if (stanza.is('presence') && stanza.attrs.type === 'subscribe' && settings.jabber.allow_auto_subscribe) {
				var subscribe_elem = new xmpp.Element('presence', {
						to : stanza.attrs.from,
						type : 'subscribed'
					});
				conn.send(subscribe_elem);
			}
	
			//messages
			if ('error' === stanza.attrs.type) {
				util.log('[error] ' + stanza.toString());
			} else if (stanza.is('message')) {
				util.log('[message] RECV: ' + stanza.getChildText('body'));
				
				//there is a callback to pass the message to
				if(typeof settings.messageCallback === 'function')
				{
					settings.messageCallback({
						from: stanza.attrs.from,
						type: stanza.attrs.type,
						body: stanza.getChildText('body')
					});					
				}
				
			}
	
		});
		
	}
	
	var join_muc = function(mucName, username)
	{
		conn.send(function () {
			el = new xmpp.Element('presence', {
					to : 'alliance_hangout@conference.jabber.spaceshipsamurai.com' + '/' + 'Kinkbot'
				});
				
			x = el.c('x', {
					xmlns : 'http://jabber.org/protocol/muc'
				});
				
			x.c('history', {
				maxstanzas : 0,
				seconds : 1
			});
			
			return x;
		}());
		
	}


	var set_status_message = function (status_message) {
		var presence_elem = new xmpp.Element('presence', {})
			.c('show').t('chat').up()
			.c('status').t(status_message);
		conn.send(presence_elem);
	}

	var send_message = function (to_jid, message_body, type) {
	
		if(type === 'groupchat')
		{
			to_jid = to_jid.substring(0, to_jid.indexOf('/'));
		}
	
		var elem = new xmpp.Element('message', {
				to : to_jid,
				type : type
			})
			.c('body').t(message_body);
		conn.send(elem);
		util.log('[message] SENT: ' + elem.up().toString());
	}
	
	return {
		set_status: set_status_message,
		connect: connect,
		send_message: send_message,
		join_muc: join_muc
	}
};

module.exports = JabberClient
