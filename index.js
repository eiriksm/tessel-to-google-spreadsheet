'use strict';
var tessel = require('tessel');
var ambientlib = require('ambient-attx4');
var ambient = ambientlib.use(tessel.port.A);
var climateLib = require('climate-si7005');
var climate = climateLib.use(tessel.port.B);
var wifi = require('wifi-cc3000');
var config = require('./config');
var interval = config.interval;
var plopId = config.plopId;
var plopHeader = config.plopHeader;
var tempId = config.tempId;
var tempHeader = config.tempHeader;
var alreadyTrying = false;
// Change this to "true" to display more verbose output.
var debug = false;
var logger = require('./src/logger')(debug);
var Queue = require('./src/queue');

config.errorCallback = function() {
  tessel.reset_board();
};
var processQueue = new Queue(config);

var tryToConnect = function() {
  if (alreadyTrying) {
    return;
  }
  if (wifi.connection()) {
    return;
  }
  if (wifi.isBusy()) {
    return;
  }
  alreadyTrying = true;
  wifi.connect({
    ssid: config.ssid,
    password: config.password
  }, function(err, res) {
    alreadyTrying = false;
    if (err) {
      logger('Wifi connect error');
      logger(err);
      return;
    }
    logger('Wifi connected');
  });
};
wifi.on('connect', function() {
  logger('Wifi connected');
});

wifi.on('disconnect', function() {
  logger('Wifi disconnect');
  setTimeout(tryToConnect, 10000);
});

wifi.on('error', function() {
  logger('Wifi error');
  setTimeout(tryToConnect, 10000);
});

wifi.on('timeout', function() {
  logger('Wifi timed out');
  setTimeout(tryToConnect, 10000);
});
wifi.reset(function() {
  logger('Did wifi reset');
});

function sendData(val, path, header) {
  processQueue.append({
    val: val,
    path: path,
    header: header
  });
}

logger('Starting timers');
var tp = require('tessel-plops-logger')(ambient, {
  interval: interval,
  debug: debug
}, tessel);
var ttl = require('tessel-temp-logger')(climate, {
  interval: interval,
  debug: debug
});
ttl.start(function(err, d) {
  if (err) {
    logger('Error from climate. Will restart board', err);
    config.errorCallback();
    return;
  }
  logger('Data from climate:', d);
  sendData(d, tempId, tempHeader);
});
tp.start(function(err, d) {
  if (err) {
    logger('Error from ambient. Will restart board', err);
    config.errorCallback();
    return;
  }
  logger('Data from ambient:', d);
  sendData(d, plopId, plopHeader);
});
processQueue.start();
