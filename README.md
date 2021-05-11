# homebridge-snug-smart-ventilator
homebridge plugin for SNUG smart ventilator. 

This plugin is for SNUG smart ventilator and based on reverse-engineered BLE communication protocol.

Before install this plugin, please firstly install bluez package in host PC.

In Debian/Ubuntu, you can install bluez by below command.

apt install bluez

In case of running homebridge in docker,you also need to install bluez in docker image.
To make easy for docker container restart scenario, you need to add below command in homebridge startup script and restart the docker container.

apk add --no-cache bluez-deprecated

And also homebridge docker's network interface mode should be "host".


After all setup, you need to find SNUG smart ventilator BT MAC address. You can find it easily with below command from homebridge terminal.
if your bluetooth adapter is hci0, the command will be like below:

hcitool hci0 up

hcitool hci0 lescan

then it shows lists of BT devices and you can find from this.(a tip to find out exact BT MAC address is comparing the result with/without power-on of SNUG device).

Please enjoy!


