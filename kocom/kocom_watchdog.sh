#!/bin/bash

while true; do
	if [ ! -f /proc/$(cat /var/run/kocom.pid)/status ]; then
		echo "Kocom service not running restart..."
		service kocom restart
	fi
	sleep 1
done
