//TODO Для развертывания веб-сервера
//var http = require('http'),
// encoding = require("encoding"),

var WEB_HOOK_REQUEST_URL = 'http://188.243.240.125:8087/',
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
    };

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

//web hook request callback
app.all('/', function (req, res) {
    console.log('hook called' + JSON.stringify(req.body));
    //for (i in req) {
    //    console.log(i);
    //}
    res.send('hello world');
});

app.listen(8087);

console.log('Integration server TaxiDispatcher with franktaxibot start, port 8087...');
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
                var jsonRes = JSON.parse(body);
                if (success) {
                    success(jsonRes);
                }
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
