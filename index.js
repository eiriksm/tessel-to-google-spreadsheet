var tessel = require('tessel');
var climatelib = require('climate-si7005');
var ambientlib = require('ambient-attx4');
var wifi = require('wifi-cc3000');
var url = require('url');
var http = require('http');
var config = require('./config');

function logger(msg) {
  //console.log(new Date().toString() + ': ' + msg);
}

var tryToConnect = function() {
  if (wifi.connection()) {
    return;
  }
  if (wifi.isBusy()) {
    setTimeout(tryToConnect, 10000);
    return;
  }
  wifi.connect({
    ssid: config.ssid,
    password: config.password
  }, function(err, res) {
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

var interval = config.interval;
var plopId = config.plopId;
var tempId = config.tempId;

function sendData(val, path) {
  logger('Sending data to ' + path);
  var opts = url.parse(config.url + path);
  opts.method = 'POST';
  var ended = false;
  var req = http.request(opts, function(res) {
    logger('STATUS: ' + res.statusCode + ' (path ' + path + ')');
    res.setEncoding('utf8');
    res.on('err', function() {
      logger('Error on res');
    });
    res.on('data', function(c) {
      logger('Path ' + path + ' has data: ' + c);
    });
    res.on('close', function() {
      logger('Request closed for path ' + path);
      ended = true;
    });
    res.on('end', function() {
      logger('Request ended for path ' + path);
      ended = true;
    });
  });
  setTimeout(function() {
    if (!ended) {
      logger('Timing out request. Will abort. Path is ' + path);
      req.abort();
    }
  }, 15000);
  req.on('error', function(e) {
    logger('Problem with request on path ' + path);
    logger(e.message);
    setTimeout(tryToConnect, 10000);
  });
  req.write(JSON.stringify({value: val}));
  req.end();
}

var climate = climatelib.use(tessel.port.C);
var ambient = ambientlib.use(tessel.port.D);

var tl = require('tessel-temp-logger')(climate, {interval: interval});
var tp = require('tessel-plops-logger')(ambient, {interval: interval}, tessel);

tl.start(function(d) {
  sendData(d, tempId);
});
// Start them not at the same time, to avoid too many sockets and such.
tp.start(function(d) {
  sendData(d, plopId);
});
