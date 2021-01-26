#!/bin/sh


find /root/PlatformBackups -type f -mtime +1 -exec rm -f {} \;
