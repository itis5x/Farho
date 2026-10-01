#!/bin/sh
# Azure App Service startup command: sh startup.sh
# App Service sets HOSTNAME to the container name; bind to all interfaces instead.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-8080}"
exec node server.js
