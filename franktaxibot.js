var http = require('http');
var encoding = require("encoding");
var express = require('express'),
    app = module.exports.app = express();
var request = require('ajax-request');

var server = http.createServer(app);
var io = require('socket.io').listen(server);  //pass a http.Server instance
server.listen(8086);
console.log('Intagration server TaxiDispatcher with franktaxibot start on port 8086...');

var sql = require('mssql');
var clientsLimit = 50;
var clientsCount = 0;

var config = {
    user: 'app_server',
    password: 'app_server',
    server: '192.168.1.90\\SQLEXPRESS', // You can use 'localhost\\instance' to connect to named instance 
    database: 'TD5R1',

    options: {
        encrypt: false // Use this if you're on Windows Azure 
    }
}

console.log('Start test db-connection...' + sql);
var connection_test = new sql.ConnectionPool(config, function (err) {
    if (err) {
        console.log(err.message);                      // Canceled.
        console.log(err.code);
    } else {
        var request = new sql.Request(connection_test);
        request.query('select COUNT(*) as number FROM Voditelj WHERE V_rabote=1', function (err, recordset) {

            console.log(recordset.recordset);
        });

    }
    console.log('End test db-connection.');

});

function checkBot() {
    console.log('[' + new Date().toUTCString() + ']');
    return false;
}

setInterval(checkBot, 10000);


 
