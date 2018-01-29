//TODO Для развертывания веб-сервера
//var http = require('http'),
// encoding = require("encoding"),

var WEB_HOOK_REQUEST_URL = 'http://188.243.240.125:8087/',
	ERR_MISS_HOOK_TYPE = 'Error: missing hook type!',
	ERR_MISS_UNKNOWN_TYPE = 'Error: unknown hook type!',
	SUCC_ORDER_ADD = 'Success: order added!',
	ERR_ORDER_ADD = 'Error order added! ',
	HOOK_TYPE_ORDER_CREATED = 'ride.created',
	request = require('request'),
	express = require('express'),
	bodyParser = require('body-parser'),
	app = module.exports.app = express(),
	sql = require('mssql'),
	config = {
		user: 'app_server',
		password: 'app_server',
		server: '192.168.1.90\\SQLEXPRESS', // You can use 'localhost\\instance' to connect to named instance
		database: 'TD5R1',
		options: {
			encrypt: false // Use this if you're on Windows Azure
		}
	}, connection;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

//web hook request callback
app.all('/', function (req, res) {
	var body = req && req.body,
		meta = body && body.meta,
		hookType = meta && meta.name,
		hookUUID = meta && meta.uuid;

	console.log('hook called' + JSON.stringify(req.body));
	if (!hookType) {
		logAndResponse(ERR_MISS_HOOK_TYPE);
		return;
	}
	//for (i in req) {
	//    console.log(i);
	//}
	//
	if (hookType === HOOK_TYPE_ORDER_CREATED) {
		queryRequest('EXEC	[dbo].[InsertOrderWithParamsRClientFBot] @adres = N\'' + data.stadr + '\', @enadres = N\'' + enadr_val + '\',@phone = N\'' + data.phone + '\',' +
			'@disp_id = -1, @status = 0, @color_check = 0, @op_order = 0, @gsm_detect_code = 0,' +
			'@deny_duplicate = 0, @colored_new = 0, @ab_num = N\'\', @client_id = ' + data.id + ', @ord_num = 0,@order_id = 0',
			function (recordset) {
				//console.log(recordset.recordset);
				logAndResponse(SUCC_ORDER_ADD);
			},
			function (err) {
				console.log(recordset.recordset);
			});
	} else {
		logAndResponse(ERR_MISS_UNKNOWN_TYPE);
	}

	function logAndResponse(message) {
		console.log(message);
		res.send(message);
	}
});

app.listen(8087);

console.log('Integration server TaxiDispatcher with franktaxibot start, port 8087...');
console.log('Start test db-connection...');

function queryRequest(sqlText, callbackSuccess, callbackError) {
	var request = new sql.Request(connection);
	request.query(sqlText, function (err, recordset) {
		if (err) {
			console.log(err.message);
			console.log(err.code);
			callbackError && callbackError(err);
		} else {
			callbackSuccess && callbackSuccess(recordset);
		}
	});
}

connection = new sql.ConnectionPool(config, function (err) {
	if (err) {
		console.log(err.message);
		console.log(err.code);
		return;
	}

	queryRequest('select COUNT(*) as number FROM Voditelj WHERE V_rabote=1',
		function (recordset) {
			console.log(recordset.recordset);
		});

});

function sendAPIRequest(params, success) {
	request(Object.assign(
		{
			method: 'GET',
			headers: {
				Authorization: 'Bearer '
			}
		}, params
	), function (err, res, body) {
		if (err) {
			console.log(err);
		} else {
			if (!body) {
				console.log('No body!');
				return;
			}

			try {
				success && success(JSON.parse(body));
			} catch (e) {
				console.log('Error of parsing json: ' +
					body + '\n' + JSON.stringify(params) + e);
				return;
			}
		}
	});
}

console.log('auth request');
sendAPIRequest(
	{
		url: 'https://api.sandbox.franktaxibot.com/auth/v1/verify'
	});

sendAPIRequest(
	{
		url: 'https://api.sandbox.franktaxibot.com/webhooks/v1',
	}, parseExistWebhooks);

function parseExistWebhooks(hooksData) {
	var hooks = hooksData && hooksData.data,
		isBadHook = true,
		hookAttributes;

	console.log('web hooks data: ' + JSON.stringify(hooks));
	if (hooks && hooks.length) {
		isBadHook = hooks.length > 1;
		hooks.forEach(function (hook, index, array) {
			hookAttributes = hook.attributes;
			isBadHook |= hookAttributes &&
				hookAttributes['request-url'] !== WEB_HOOK_REQUEST_URL;

			if (isBadHook) {
				console.log('delete hook, id=' + hook.id);
				deleteWebHook(hook.id);
			}
		});
	}

	isBadHook && sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/webhooks/v1',
			method: 'POST',
			body: JSON.stringify({
				'request-url': WEB_HOOK_REQUEST_URL,
				'request-method': 'GET'
			})
		});
	return;
}

function deleteWebHook(id) {
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/webhooks/v1/' + id,
			method: 'DELETE'
		});
}

function checkBot() {
	//console.log('[' + new Date().toUTCString() + ']');
	return false;
}

setInterval(checkBot, 10000);
