const DEBUG = false;

const clientScreens = {};
const screenChangeListeners = {}; // Function handles for disconnecting event listeners.


const log = (...params) => DEBUG && console.log('restoreToScreen::', params.join(' '));


const setScreen = cli => {
    log('setScreen', cli.resourceName );
    if (!clientScreens[workspace.numScreens]) clientScreens[workspace.numScreens] = {};
    clientScreens[workspace.numScreens][cli] = cli.screen;
    // log('state', JSON.stringify(clientScreens[workspace.numScreens], null, 2))
};


const restoreScreens = (screenCnt) => {
    log('restoreScreens', screenCnt);
    const conf = clientScreens[screenCnt];
    if (!conf) return;

    workspace.clientList()
        .filter(cli => conf[cli] !== undefined && conf[cli] !== cli.screen)
        .forEach(cli => workspace.sendClientToScreen(cli, conf[cli]));
};


const registerClient = cli => {
    if (!cli.normalWindow) return;
    log('registerClient', cli.resourceName);
    cli.clientFinishUserMovedResized.connect(setScreen)

    screenChangeListeners[cli] = () => setScreen(cli);
    cli.screenChanged.connect(screenChangeListeners[cli])

    setScreen(cli);
};


const unregisterClient = cli => {
    if (!screenChangeListeners[cli]) return;

    log('unregisterClient', cli.resourceName);
    
    cli.clientFinishUserMovedResized.disconnect(setScreen);

    cli.screenChanged.disconnect(screenChangeListeners[cli]);
    delete screenChangeListeners[cli];

    Object.values(clientScreens).forEach(config => delete config[cli]);
};


workspace.clientList().forEach(registerClient);

workspace.clientAdded.connect(registerClient);
workspace.clientRemoved.connect(unregisterClient);
workspace.numberScreensChanged.connect(restoreScreens);

