//TODO Для развертывания веб-сервера
//var http = require('http'),
// encoding = require("encoding"),
// express = require('express'),
// app = module.exports.app = express();
var request = require('request'),
    sql = require('mssql'),
    config = {
        user: 'app_server',
        password: 'app_server',
        server: '192.168.1.90\\SQLEXPRESS', // You can use 'localhost\\instance' to connect to named instance
        database: 'TD5R1',
        options: {
            encrypt: false // Use this if you're on Windows Azure
        }
    };

console.log('Integration server TaxiDispatcher with franktaxibot start...');
console.log('Start test db-connection...' + sql);
var connection_test = new sql.ConnectionPool(config, function (err) {
    if (err) {
        console.log(err.message);
        console.log(err.code);
        return;
    }

    var request = new sql.Request(connection_test);
    request.query('select COUNT(*) as number FROM Voditelj WHERE V_rabote=1',
        function (err, recordset) {
            console.log(recordset.recordset);
        });

});

function sendAPIRequest(params, success) {
    console.log('===============0');
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
            var jsonRes;
            console.log('===============1');
            if (!body) {
                console.log('No body!');
                return;
            }

            try {
                jsonRes = JSON.parse(body);
                //jsonRes && console.log(jsonRes);
                //jsonRes.included && console.log(jsonRes.included);
                if (success) {
                    success(jsonRes);
                }
            } catch (e) {
                console.log('Error of parsing json: ' + body + '\n' + JSON.stringify(params) + e);
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
    var hooks = hooksData && hooksData.data;

    console.log('web hooks data: ' + JSON.stringify(hooks));
    hooks && hooks.length && hooks.length > 1 && hooks.forEach(function(hook, index, array) {
        console.log('delete hook id=' + hook.id + '===' + hook);
        //deleteWebHook(hook.id);
    });

    (!hooks || hooks.length > 1) && sendAPIRequest(
        {
            url: 'https://api.sandbox.franktaxibot.com/webhooks/v1',
            method: 'POST',
            body: JSON.stringify({
                'request-url': 'http://psdevelop.ru/franktaxibot/',
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
