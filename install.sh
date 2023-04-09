#!/bin/bash

if [[ `kpackagetool5 -l | grep "restoreToScreen"` ]]; then
    echo "Updating..."
    kpackagetool5 --type=KWin/Script -u .
    kwriteconfig5 --file kwinrc --group Plugins --key restoreToScreen false
    qdbus org.kde.KWin /KWin reconfigure
    sleep 2;
    kwriteconfig5 --file kwinrc --group Plugins --key restoreToScreen true
    qdbus org.kde.KWin /KWin reconfigure
else
    echo "Installing..."
    kpackagetool5 --type=KWin/Script -i .
fi