#!/bin/bash

if [[ `kpackagetool5 -l | grep "restoreToScreen"` ]]; then
    echo "Updating..."
    kpackagetool5 --type=KWin/Script -u .
else
    echo "Installing..."
    kpackagetool5 --type=KWin/Script -i .
fi