//TODO Для развертывания веб-сервера
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
		user: 'franktaxibot',
		password: 'franktaxibot',
		server: '192.168.1.90\\SQLEXPRESS', // You can use 'localhost\\instance' to connect to named instance
		database: 'TD5R1',
		options: {
			encrypt: false // Use this if you're on Windows Azure
		}
	}, connection,
	baseLat = 59.9289443, baseLon = 30.2758098, radius = 20.0,
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

	if (!orderId) {
		logAndResponse('Missing order id!');
		return;
	}

	console.log('hook called, type=' + hookType +
		',orderLocFromCity=' + fromCity +
		',orderPhoneNumber=' + phoneNumber +
		',orderId=' + orderId +
		',calcDistanceFrom=' + calcDistanceFromText);

	if (hookType === HOOK_TYPE_ORDER_CREATED &&
		calcDistanceFrom && calcDistanceFrom < radius) {

		addOrderSQL = 'EXEC	[dbo].[InsertOrderWithParamsRClientFBot] @adres = N\'' +
			prepareAddr(fromAddress, [fromCountry, fromZip]) + '\', @enadres = N\'' +
			prepareAddr(toAddress, [toCountry, toZip]) + '\',@phone = N\'' +
			phoneNumber.replace(phoneTrimPrefix, '') + '\',' +
			' @disp_id = -1, @status = 0, @color_check = 0,' +
			' @op_order = 0, @gsm_detect_code = 0, @deny_duplicate = 0,' +
			' @colored_new = 0, @ab_num = N\'\', @client_id = ' + 1 +
			', @src_id = N\'' + orderId + '\', @ord_num = 0, @order_id = 0';

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
				orderId: orderId
			}
		);

		logAndResponse('Detecting order.create hook!');
	} else if (hookType === HOOK_TYPE_ORDER_ACCEPTED) {
		logAndResponse('Detecting order.accepted hook!');
	} else if (hookType === HOOK_TYPE_ORDER_CANCELED) {
		cancelOrderInDB(
			{
				orderId: orderId,
				fromBot: true
			}
		);
		logAndResponse('Detecting order.canceled hook!');
	} else if (hookType === HOOK_TYPE_ORDER_UPDATED) {
		logAndResponse('Detecting order.updated hook!');
	} else if (hookType === HOOK_TYPE_ORDER_COMPLETED) {
		logAndResponse('Detecting order.completed hook!');
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
	//'partner-ride-id' : -1,
	//'driver-id' : -1,

	console.log('SEND ACCEPT POST REQUEST');
	console.log('https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
		orderId + '/accept');
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
			orderId + '/accept',
			method: 'POST',
			body: JSON.stringify(options)
		},
		acceptCallback,
		{
			orderId: orderId
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
		return;
	}

	console.log('Bad accept response!');
	return false;
}

function completeOrder(options) {
	var orderId = options && options.orderId;
	//'final-fare': 250.0,
	//'final-distance': 5600,
	//'final-time': 21
	//'final-base-fare' : 50,
	//'final-normal-fare' : 50,
	//'final-surge' : 0,
	//'driver-id' : -1,
	//'driver-name' : 'Alexandr',
	//'driver-phone' : '+79883138837',
	//'car-plate' : 'SS 101 AG',
	//'car-model' : 'Lada Largus 7x'
	//'pickup-in' : 50

	console.log('SEND COMPLETE POST REQUEST');
	console.log('https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
		orderId + '/complete');
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
			orderId + '/complete',
			method: 'POST',
			body: JSON.stringify(options)
		},
		completeCallback,
		{
			orderId: orderId
		}
	);
}

function completeCallback(acqBody, options) {
	var acqData = acqBody && acqBody.data,
		acqType = acqData && acqData.type || '',
		accId = acqData && acqData.id || '',
		orderId = options && options.orderId;

	if (acqType === 'ride' && accId === orderId) {
		console.log('Order completed!');
		return;
	}

	console.log('Bad complete response!');
	return false;
}

function cancelOrder(options) {
	var orderId = options && options.orderId;

	console.log('SEND CANCEL POST REQUEST');
	console.log('https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
		orderId + '/cancel');
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/marketplace/v1/rides/' +
			orderId + '/cancel',
			method: 'POST',
			body: JSON.stringify({
				//'reason' : 'driver is dest error',
			})
		},
		cancelCallback,
		{
			orderId: orderId
		}
	);
}

function cancelCallback(acqBody, options) {
	var acqData = acqBody && acqBody.data,
		acqType = acqData && acqData.type || '',
		accId = acqData && acqData.id || '',
		orderId = options && options.orderId;

	if (acqType === 'ride' && accId === orderId) {
		console.log('Order canceled!');
		return;
	}

	console.log('Bad cancel response!');
	return false;
}

function updateOrder(options) {
	var orderId = options && options.orderId;

	console.log('SEND UPDATE PATCH REQUEST');
	console.log('https://api.sandbox.franktaxibot.com/' +
		'marketplace/v1/rides/' + orderId);
	sendAPIRequest(
		{
			url: 'https://api.sandbox.franktaxibot.com/' +
			'marketplace/v1/rides/' + orderId,
			method: 'PATCH',
			body: JSON.stringify(options)
		},
		updateCallback,
		{
			orderId: orderId
		}
	);
}

function updateCallback(acqBody, options) {
	var acqData = acqBody && acqBody.data,
		acqType = acqData && acqData.type || '',
		accId = acqData && acqData.id || '',
		orderId = options && options.orderId;

	if (acqType === 'ride' && accId === orderId) {
		console.log('Order updated!');
		return;
	}

	console.log('Bad update response!');
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

function checkBotData() {
	queryRequest('SELECT EstjVneshnieManip FROM Personal' +
		' WHERE Login = \'franktaxibot\' AND EstjVneshnieManip = 1',
		function (recordset) {
			var recordsetData = recordset && recordset.recordset;
			recordsetData && recordsetData.length && updateFlagProcessing();
		});
	return false;
}

function updateFlagProcessing() {
	console.log('Data updating:[' + new Date().toUTCString() + ']');
	resetUpdateFlag();
	checkAcceptedOrders();
	checkCompletedOrders();
	checkCanceledOrders();
	checkOnPlaceOrders();
	return false;
}

function resetUpdateFlag() {
	queryRequest('UPDATE Personal SET EstjVneshnieManip = 0' +
		' WHERE Login = \'franktaxibot\'', null,
		function (err) {
			console.log('Error of updateFlag reset!');
		});
	return false;
}

function checkAcceptedOrders() {
	queryRequest('SELECT src_id as orderId, Marka_avtomobilya as car_model, ' +
		' Gos_nomernoi_znak as car_plate, phone_number as driver_phone, ' +
		' driver_name FROM ActiveOrders ' +
		' WHERE src = 1 AND src_status_code < 8 AND ' +
		' REMOTE_SET = 8 AND REMOTE_SYNC = 0 AND Zavershyon = 0',
		function (recordset) {
			var recordsetData = recordset && recordset.recordset,
				acceptOptions, orderId, driverName;

			recordsetData && recordsetData.length &&
			recordsetData.forEach(function (element, index, array) {
				orderId = element.orderId;
				acceptOptions = {
					orderId: orderId,
					'driver-name': element.driver_name,
					'driver-phone': element.driver_phone,
					'car-model': element.car_model,
					'car-plate': element.car_plate
				};
				orderId && acceptOrderInDB(acceptOptions);
				orderId && acceptOrder(acceptOptions);
			});
		});
	return false;
}

function acceptOrderInDB(options) {
	var orderId = options && options.orderId,
		fromBot = options && options.fromBot;
	queryRequest('UPDATE Zakaz SET src_status_code = 8' +
		' WHERE src = 1 AND src_status_code < 8 AND ' +
		' REMOTE_SET = 8 AND REMOTE_SYNC = 0 AND src_id = \'' + orderId + '\'',
		function (recordset) {
			console.log('SUCCESS ACCEPT ORDER IN DB');
		},
		function (err) {
			console.log('ERROR ACCEPT ORDER IN DB: ' + err);
		});
}

function checkCompletedOrders() {
	queryRequest('SELECT src_id as orderId, Uslovn_stoim as order_summ, ' +
		' REMOTE_SUMM as driver_summ, fixed_time as order_time, ' +
		' tm_distance as order_distance FROM Zakaz' +
		' WHERE src = 1 AND src_status_code <> 100 AND ' +
		' (REMOTE_SET IN (26, 100) OR Zavershyon = 1) AND Arhivnyi = 0',
		function (recordset) {
			var recordsetData = recordset && recordset.recordset,
				completeOptions, orderId;

			recordsetData && recordsetData.length &&
			recordsetData.forEach(function (element, index, array) {
				orderId = element.orderId;
				console.log(orderId);
				completeOptions = {
					orderId: orderId,
					'final-fare': element.order_summ || '',
					'final-distance': element.order_distance || '',
					'final-time': element.order_time || ''
				};
				orderId && completeOrderInDB(completeOptions);
				orderId && completeOrder(completeOptions);
			});
		});
	return false;
}

function completeOrderInDB(options) {
	var orderId = options && options.orderId,
		fromBot = options && options.fromBot;
	queryRequest('UPDATE Zakaz SET src_status_code = 100' +
		' WHERE src = 1 AND src_status_code <> 100 AND ' +
		' (REMOTE_SET IN (26, 100) OR Zavershyon = 1) AND Arhivnyi = 0 AND src_id = \'' + orderId + '\'',
		function (recordset) {
			console.log('SUCCESS COMPLETE ORDER IN DB');
		},
		function (err) {
			console.log('ERROR COMPLETE ORDER IN DB: ' + err);
		});
}

function checkCanceledOrders() {
	queryRequest('SELECT src_id as orderId FROM Zakaz' +
		' WHERE src = 1 AND src_status_code = 8 AND ' +
		' (REMOTE_SET NOT IN (8, 26, 100) OR Arhivnyi = 1)',
		function (recordset) {
			var recordsetData = recordset && recordset.recordset,
				cancelOptions, orderId;

			recordsetData && recordsetData.length &&
			recordsetData.forEach(function (element, index, array) {
				orderId = element.orderId;
				console.log(orderId);
				cancelOptions = {orderId: orderId};
				orderId && cancelOrderInDB(cancelOptions);
				orderId && cancelOrder(cancelOptions);
			});
		});
	return false;
}

function cancelOrderInDB(options) {
	var orderId = options && options.orderId,
		fromBot = options && options.fromBot,
		updSql = 'EXEC	[dbo].[CancelOrdersRClientFBot] @order_id = N\'' +
			orderId + '\', @is_bot = ' + (fromBot ? 1 : 0) + ', @res =  0';
	queryRequest(updSql,
		function (recordset) {
			console.log('SUCCESS CANCEL ORDER IN DB');
		},
		function (err) {
			console.log('ERROR CANCEL ORDER IN DB: ' + err);
		});
}

function checkOnPlaceOrders() {
	queryRequest('SELECT src_id as orderId FROM ActiveOrders ' +
		' WHERE src = 1 AND src_status_code = 8 AND ' +
		' REMOTE_SET = 8 AND REMOTE_SYNC = 0 AND Zavershyon = 0 AND ' +
		' on_place = 1 AND src_on_place = 0',
		function (recordset) {
			var recordsetData = recordset && recordset.recordset,
				orderOptions, orderId;

			recordsetData && recordsetData.length &&
			recordsetData.forEach(function (element, index, array) {
				orderId = element.orderId;
				if (!orderId) {
					return;
				}

				orderOptions = {
					orderId: orderId
				};
				setOnPlaceOrderInDB(orderOptions);
				sendOnPlaceOrder(orderOptions);
			});
		});
	return false;
}

function sendOnPlaceOrder(options) {
	updateOrder(
		Object.assign(
			{
				'pickup-in' : 0
			},
			options
		)
	);
}

function setOnPlaceOrderInDB(options) {
	var orderId = options && options.orderId,
		updSql = 'UPDATE Zakaz SET src_on_place = 1 ' +
			' WHERE src = 1 AND src_status_code = 8 AND ' +
			' REMOTE_SET = 8 AND REMOTE_SYNC = 0 AND Zavershyon = 0 AND ' +
			' on_place = 1 AND src_on_place = 0 AND src_id = \'' + orderId + '\'';
	queryRequest(updSql,
		function (recordset) {
			console.log('SUCCESS ONPLACE ORDER IN DB');
		},
		function (err) {
			console.log('ERROR ONPLACE ORDER IN DB: ' + err);
		});
}

setInterval(checkBotData, 3000);
