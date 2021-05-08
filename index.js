const OPERATION_MODE_NORMAL = 0;
const OPERATION_MODE_AUTO_INTERVAL_TIMER = 1;
const OPERATION_MODE_AUTO_C02_SENSOR = 2;
const OPERATION_MODE_AUTO_TEMPERATURE = 3;
const OPERATION_MODE_TIMER = 4;

var Service, Characteristic, HomebridgeAPI;
var util = require('util'), exec = require('child_process').exec, child;
var numeral = require('numeral');

const str = '';
const AsciiToHex = (str = '') => {
  const res = [];
  const { length: len } = str;
  for (let n = 0, l = len; n < l; n++) {
    const hex = Number(str.charCodeAt(n)).toString(16).toLowerCase();
    res.push(hex);
  };
  return res.join('');
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-snug-smart-ventilator", "SnugSmartVentilator", SnugSmartVentilator);
}

function SnugSmartVentilator(log, config) {
  this.log = log;
  this.name = config.name;
  this.stateful = true;
  this.reverse = false;
  this.time = 1000;
  this.ventilator = config.ventilator;
  this.host = config.host;

  this.fan_speed = config.fan_speed;
  this.interval_timer_mode_period = config.interval_timer_mode_period;
  this.interval_timer_mode_duration = config.interval_timer_mode_duration;
  this.co2_level_trigger_min = config.co2_level_trigger_min;
  this.co2_level_trigger_max = config.co2_level_trigger_max;
  this.temperature_trigger_mode_threshold_min = config.temperature_trigger_mode_threshold_min;
  this.temperature_trigger_mode_threshold_max = config.temperature_trigger_mode_threshold_max;
  this.operation_mode = config.operation_mode;
  this.timer_mode_hour = config.timer_mode_hour;
  this.timer_mode_minute = config.timer_mode_minute;

  this._service = new Service.Switch(this.name);

  this.cacheDirectory = HomebridgeAPI.user.persistPath();
  this.storage = require('node-persist');
  this.storage.initSync({
    dir: this.cacheDirectory,
    forgiveParseErrors: true
  });

  this._service.getCharacteristic(Characteristic.On).on('set', this._setOn.bind(this));

  var cachedState = this.storage.getItemSync(this.name);
  if ((cachedState === undefined) || (cachedState === false)) {
    this._service.setCharacteristic(Characteristic.On, false);
  }
  else {
    this._service.setCharacteristic(Characteristic.On, true);
  }
}

SnugSmartVentilator.prototype.getServices = function () {
  var informationService = new Service.AccessoryInformation();
  informationService.setCharacteristic(Characteristic.Manufacturer, "JS Ha")
  informationService.setCharacteristic(Characteristic.Model, "SnugSmartVentilator")
  informationService.setCharacteristic(Characteristic.SerialNumber, this.ventilator);

  this.informationService = informationService;

  return [informationService, this._service];
}

SnugSmartVentilator.prototype._setOn = function (on, callback) {
  this.storage.setItemSync(this.name, on);
  var command_to_snug_ventilator = "";
  var command_to_snug_ventilator_comment = "";

  if (on == true) {
    if (this.operation_mode == OPERATION_MODE_NORMAL) {
      // 0x02 + "O" + "1" + 3 digit ascii string for fan speed + 0x03 + 0x0d + 0x0a
      command_to_snug_ventilator = "024f31" + AsciiToHex(numeral(this.fan_speed).format('000')) + "030d0a";
      command_to_snug_ventilator_comment = "Setting fan to ON : [Normal mode]" + command_to_snug_ventilator;
    }
    else {
      if (this.operation_mode == OPERATION_MODE_TIMER) {
        if ((this.timer_mode_hour != 0) || (this.timer_mode_minute != 0)) {
          // 0x02 + "C" + "025" + 2 digit ascii string for hour(in hour) + 2 digit ascii string for minute + 0x03 + 0x0d + 0x0a
          command_to_snug_ventilator = "0243303235" + AsciiToHex(numeral(this.timer_mode_hour).format('00')) + AsciiToHex(numeral(this.timer_mode_minute).format('00')) + "030d0a";
          command_to_snug_ventilator_comment = "Setting fan to ON : Timer : " + command_to_snug_ventilator;
        }
        else {
          this.log("Error : Invalid timer setting!");
        }
      }
      else {
        if (this.operation_mode == OPERATION_MODE_AUTO_INTERVAL_TIMER) {
          // 0x02 + "S" + "001" + 2 digit ascii string for period(in hour) + "0" + 2 digit ascii string for duration(in minute) + 0x03 + 0x0d + 0x0a
          command_to_snug_ventilator = "0253303031" + AsciiToHex(numeral(this.interval_timer_mode_period).format('00')) + "3030" + AsciiToHex(numeral(this.interval_timer_mode_duration).format('00')) + "030d0a";
          command_to_snug_ventilator_comment = "Setting fan to ON : Auto(interval) : " + command_to_snug_ventilator;
        }
        else {
          if (this.operation_mode == OPERATION_MODE_AUTO_C02_SENSOR) {
            if (this.co2_level_trigger_min < this.co2_level_trigger_max) {
              // 0x02 + "D" + "001" + 4 digit ascii string for minimum-c02-level + 4 digit ascii string for maximum-c02-level + 0x03 + 0x0d + 0x0a
              command_to_snug_ventilator = "0244303031" + AsciiToHex(numeral(this.co2_level_trigger_min).format('0000')) + AsciiToHex(numeral(this.co2_level_trigger_max).format('0000')) + "030d0a";
              command_to_snug_ventilator_comment = "Setting fan to ON : Auto(Co2) : " + command_to_snug_ventilator;
            }
            else {
              this.log("Error : Invalid CO2 level setting!");
            }
          } 
          else {
            if (this.operation_mode == OPERATION_MODE_AUTO_TEMPERATURE) {
              if (this.temperature_trigger_mode_threshold_min < this.temperature_trigger_mode_threshold_max) {
                // 0x02 + "T" + "001" + 3 digit ascii string for minimum-temp + "0" + 3 digit ascii string for maximum-temp + "0" + 0x03 + 0x0d + 0x0a
                command_to_snug_ventilator = "0254303031" + AsciiToHex(numeral(this.temperature_trigger_mode_threshold_min).format('000')) + "30" + AsciiToHex(numeral(this.temperature_trigger_mode_threshold_max).format('000')) + "30" + "030d0a";
                command_to_snug_ventilator_comment = "Setting fan to ON : Auto(Temp) : " + command_to_snug_ventilator;
              }
              else {
                this.log("Error : Invalid temperature range setting!");
              }
            }
          }
        }
      }
    }
  }
  else {
    // 0x02 + "O" + "1" + "3 digit ascii string for fan speed 0" + 0x03 + 0x0d + 0x0a
    command_to_snug_ventilator = "024f31" + AsciiToHex(numeral(0).format('000')) + "030d0a";
    command_to_snug_ventilator_comment = "Setting fan to OFF : " + command_to_snug_ventilator;
  }

  if (command_to_snug_ventilator.length > 0) {
    child = exec("gatttool -i hci0 -b " + this.ventilator + " --char-write-req -a 0x002a -n " + command_to_snug_ventilator,
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log("Error: " + stderr);
        }
        else {
          console.log(command_to_snug_ventilator_comment);
          callback();
        }
      }
    );
  } 
}
