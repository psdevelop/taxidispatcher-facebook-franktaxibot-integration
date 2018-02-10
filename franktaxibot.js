﻿//TODO Для развертывания веб-сервера
//var http = require('http'),
// encoding = require("encoding"),

var WEB_HOOK_REQUEST_URL = 'http://188.243.240.125:8087/',
	ERR_MISS_HOOK_TYPE = 'Error: missing hook type!',
	ERR_MISS_UNKNOWN_TYPE = 'Error: unknown hook type!',
	SUCC_ORDER_ADD = 'Success: order added!',
	ERR_ORDER_ADD = 'Error order added! ',
	HOOK_TYPE_ORDER_CREATED = 'ride.created',
	HOOK_TYPE_ORDER_UPDATED = 'ride.updated',
	HOOK_TYPE_ORDER_CANCELED = 'ride.canceled',
	HOOK_TYPE_ORDER_ACCEPTED = 'ride.accepted',
	HOOK_TYPE_ORDER_COMPLETED = 'ride.completed',
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
	}, connection,
	baseLat = 59.9289443, baseLon = 30.2758098, radius = 2.0,
	phoneTrimPrefix = '+7';

function getDistance(x1, y1, x2, y2) {
	return Math.sqrt(
		Math.pow(x1 - x2, 2)
		+
		Math.pow(y1 - y2, 2)
	);
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// parse application/json
app.use(bodyParser.json());

//web hook request callback
app.all('/', function (req, res) {
	var body = req && req.body,
		meta = body && body.meta,
		hookType = meta && meta.name,
		hookUUID = meta && meta.uuid,
		orderData = body && body.data,
		orderId = orderData && orderData.id,
		orderAttrs = orderData && orderData.attributes,
		ordersRels = orderData && orderData.relationships,
		ordersReceipt = ordersRels && orderData.receipt,
		ordersCustomer = ordersRels && orderData.customer,
		customerData = ordersCustomer && ordersCustomer.data,
		orderIncluded = body && body.included,
		//'wait_for_accept'
		orderState = getOrderAttr('state') || '',
		passengers = getOrderAttr('passengers'),
		luggage = getOrderAttr('luggage'),
		distance = parseInt(getOrderAttr('travel-distance') || '0', 10),
		phoneNumber = String(getOrderAttr('phone-number') || ''),
		fromCountry = getOrderAttr('location-from-country') || '',
		fromCity = getOrderAttr('location-from-city') || '',
		fromZip = getOrderAttr('location-from-zip') || '',
		fromAddress = String(getOrderAttr('location-from-address') || ''),
		fromLat = getOrderAttr('location-from-latitude'),
		fromLon = getOrderAttr('location-from-longitude'),
		fromIsAirport = !!getOrderAttr('location-from-is-airport'),
		toCountry = getOrderAttr('location-to-country') || '',
		toCity = getOrderAttr('location-to-city') || '',
		toZip = getOrderAttr('location-to-zip') || '',
		toAddress = String(getOrderAttr('location-to-address') || ''),
		toLat = getOrderAttr('location-to-latitude'),
		toLon = getOrderAttr('location-to-longitude'),
		toIsAirport = !!getOrderAttr('location-to-is-airport'),
		fromPrice = getOrderAttr('price-from'),
		toPrice = getOrderAttr('price-to'),
		fromCurrency = getOrderAttr('currency-from'),
		toCurrency = getOrderAttr('currency-to'),
		finalFare = getOrderAttr('final-fare'),
		priceSurge = getOrderAttr('price-surge'),
		airportTerminal = getOrderAttr('airport-terminal'),
		airArrOrDep = getOrderAttr('airport-arrival-or-departure'),
		airportExitDoor = getOrderAttr('airport-exit-door'),
		optCabType = getOrderAttr('option-cab-type'),
		optChildSeat = getOrderAttr('option-children-seat'),
		optPetsAviable = getOrderAttr('option-pets-aviable'),
		optDriverType = getOrderAttr('option-driver-type'),
		paymentType = getOrderAttr('payment-type'), //cash
		customerCharged = !!getOrderAttr('customer-charged'),
		orderType = getOrderAttr('order-type'), // 'standard'
		priceLevel = getOrderAttr('price-level'), // economy
		baseFare = getOrderAttr('base-fare'),
		pricePerKm = getOrderAttr('price-per-km'),
		pricePerMin = getOrderAttr('price-per-min'),
		createdAt = getOrderAttr('created-at'),
		completedAt = getOrderAttr('completed-at'),
		partnerRideId = getOrderAttr('partner-ride-id'),
		driverId = getOrderAttr('driver-id'),
		driverName = getOrderAttr('driver-name'),
		driverPhone = getOrderAttr('driver-phone'),
		carPlate = getOrderAttr('car-plate'),
		carModel = getOrderAttr('car-model'),
		carLat = getOrderAttr('car-latitude'),
		carLon = getOrderAttr('car-longitude'),
		pickupIn = getOrderAttr('pickup-in'),
		pickedUp = getOrderAttr('picked-up'),
		pickedUpAt = getOrderAttr('picked-up-at'),
		acceptedAt = getOrderAttr('accepted-at'),
		calcDistanceFrom = fromLat && fromLon &&
			getDistance(fromLat, fromLon, baseLat, baseLon),
		calcDistanceFromText = calcDistanceFrom || 'не определено',
		calcDistanceTo = toLat && toLon &&
			getDistance(toLat, toLon, baseLat, baseLon),
		calcDistanceToText = calcDistanceTo || 'не определено';

	function getOrderAttr(key) {
		return orderAttrs && orderAttrs[key];
	}

	function prepareAddr(addr, fragments) {
		fragments.forEach(function (fragment, index, array) {
			fragment && addr.replace(', ' + fragment, '')
				.replace(' ' + fragment, '');
		});
		return addr.replace('\'', '"');
	}

	if (!hookType) {
		logAndResponse('Missing hook type!');
		return;
	}

	console.log('hook called, type=' + hookType +
		',orderLocFromCity=' + fromCity +
		',orderPhoneNumber=' + phoneNumber +
		',orderId=' + orderId +
		',calcDistanceFrom=' + calcDistanceFromText);

	if (hookType === HOOK_TYPE_ORDER_CREATED && orderId &&
		calcDistanceFrom && calcDistanceFrom < radius) {

		addOrderSQL = 'EXEC	[dbo].[InsertOrderWithParamsRClientFBot] @adres = N\'' +
			prepareAddr(fromAddress, [fromCountry, fromZip]) + '\', @enadres = N\'' +
			prepareAddr(toAddress, [toCountry, toZip]) + '\',@phone = N\'' +
			phoneNumber.replace(phoneTrimPrefix, '') + '\',' +
			' @disp_id = -1, @status = 0, @color_check = 0,' +
			' @op_order = 0, @gsm_detect_code = 0, @deny_duplicate = 0,' +
			' @colored_new = 0, @ab_num = N\'\', @client_id = ' + 1 +
			', @ord_num = 0,@order_id = 0';

		console.log('SEND ACQUIRE POST REQUEST');
		console.log('https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
			orderId + '/acquire');
		sendAPIRequest(
			{
				url: 'https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
				orderId + '/acquire',
				method: 'POST'
			},
			acquireCallback,
			{
				addOrderSQL: addOrderSQL,
				orderId : orderId
			}
		);


	} else {
		logAndResponse(ERR_MISS_UNKNOWN_TYPE);
	}

	function logAndResponse(message) {
		console.log(message);
		res.send(message);
	}
});

function acquireCallback(acqBody, options) {
	var acqData = acqBody && acqBody.data,
		acqType = acqData && acqData.type || '',
		acqId = acqData && acqData.id || '',
		addOrderSQL = options && options.addOrderSQL,
		orderId = options && options.orderId;

	if (acqType === 'ride' && acqId === orderId && addOrderSQL) {
		queryRequest(addOrderSQL,
			function (recordset) {
				console.log(SUCC_ORDER_ADD);
				acceptOrder({orderId : orderId});
			},
			function (err) {
				console.log(err);
			});
		return;
	}

	console.log('Bad acq response!');
	return false;
}

function acceptOrder(options) {
	var orderId = options && options.orderId;

	console.log('SEND ACCEPT POST REQUEST');
	console.log('https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
		orderId + '/accept');
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
			orderId + '/accept',
			method: 'POST',
			body: JSON.stringify({
				'driver-name' : 'Alexandr',
				'driver-phone' : '+79883138837',
				'car-plate' : 'SS 101 AG',
				'car-model' : 'Lada Largus 7x'
			})
		},
		acceptCallback,
		{
			orderId : orderId
		}
	);
}

function acceptCallback(acqBody, options) {
	var acqData = acqBody && acqBody.data,
		acqType = acqData && acqData.type || '',
		accId = acqData && acqData.id || '',
		orderId = options && options.orderId;

	if (acqType === 'ride' && accId === orderId) {
		console.log('Order accepted!');
		/*queryRequest(addOrderSQL,
			function (recordset) {
				console.log(SUCC_ORDER_ADD);
			},
			function (err) {
				console.log(err);
			});*/
		return;
	}

	logAndResponse('Bad accept response!');
	return false;
}

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

function sendAPIRequest(params, success, options) {
	request(Object.assign(
		{
			method: 'GET',
			headers: {
				Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImp0aSI6ImYwNjc2NmQ5YzlhYzliZTVhYzYyNThiYTJmOWRjNzcxZDQxMDRjYzlhYmE5Y2VjMzBlODgxOTQ4Mjc3MzIxZDkxNjJiZGM0N2JjYTYxZDJiIn0.eyJhdWQiOiJmMWFiMzk1Mzk4ODU3Y2Y2MjE2YSIsImp0aSI6ImYwNjc2NmQ5YzlhYzliZTVhYzYyNThiYTJmOWRjNzcxZDQxMDRjYzlhYmE5Y2VjMzBlODgxOTQ4Mjc3MzIxZDkxNjJiZGM0N2JjYTYxZDJiIiwiaWF0IjoxNTE2MDIwNTYyLCJuYmYiOjE1MTYwMjA1NjIsImV4cCI6NDY3MTY5NDE2Miwic3ViIjoiMjQiLCJzY29wZXMiOltdfQ.F78V_W9Yag4-_i_JzcEqZB9I-vimKBgjj9GBpw1IBy4'
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
				success && success(JSON.parse(body), options);
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

function parseExistWebhooks(hooksData, options) {
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
