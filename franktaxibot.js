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
    } else {
        var request = new sql.Request(connection_test);
        request.query('select COUNT(*) as number FROM Voditelj WHERE V_rabote=1',
            function (err, recordset) {
                console.log(recordset.recordset);
            });
    }
    console.log('End test db-connection.');

});

console.log('auth request');
request({
    url: 'https://api.sandbox.franktaxibot.com/auth/v1/verify',
    method: 'GET',
    headers: {
        Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImp0aSI6ImYwNjc2NmQ5YzlhYzliZTVhYzYyNThiYTJmOWRjNzcxZDQxMDRjYzlhYmE5Y2VjMzBlODgxOTQ4Mjc3MzIxZDkxNjJiZGM0N2JjYTYxZDJiIn0.eyJhdWQiOiJmMWFiMzk1Mzk4ODU3Y2Y2MjE2YSIsImp0aSI6ImYwNjc2NmQ5YzlhYzliZTVhYzYyNThiYTJmOWRjNzcxZDQxMDRjYzlhYmE5Y2VjMzBlODgxOTQ4Mjc3MzIxZDkxNjJiZGM0N2JjYTYxZDJiIiwiaWF0IjoxNTE2MDIwNTYyLCJuYmYiOjE1MTYwMjA1NjIsImV4cCI6NDY3MTY5NDE2Miwic3ViIjoiMjQiLCJzY29wZXMiOltdfQ.F78V_W9Yag4-_i_JzcEqZB9I-vimKBgjj9GBpw1IBy4'
    }
}, function (err, res, body) {
    if (err) {
        console.log(err);
    } else {
        var jsonRes;

        if (!body) {
            return;
        }

        try {
            jsonRes = JSON.parse(body);
            jsonRes.data && console.log(jsonRes.data);
            jsonRes.included && console.log(jsonRes.included);
        } catch (e) {
            console.log(body);
            return;
        }
    }
});

function checkBot() {
    console.log('[' + new Date().toUTCString() + ']');
    return false;
}

setInterval(checkBot, 10000);
