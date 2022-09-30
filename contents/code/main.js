const DEBUG = false;

const clientScreens = {};
const screenChangeListeners = {}; // Function handles for disconnecting event listeners.


const log = (...params) => DEBUG && console.log('restoreToScreen::', params.join(' '));


const isHandleable = cli => cli.normalWindow;


const setScreen = cli => {
    if (workspace.numScreens == 1) return;

    log('setScreen', cli.resourceName, 'config', workspace.numScreens, 'client screen', cli.screen);
    if (!clientScreens[workspace.numScreens]) clientScreens[workspace.numScreens] = {};
    clientScreens[workspace.numScreens][cli] = cli.screen;
    // log('state', JSON.stringify(clientScreens[workspace.numScreens], null, 2))
};


const restoreScreens = (screenCnt) => {
    if (workspace.numScreens == 1) return;

    log('restoreScreens', screenCnt);

    workspace.clientList()
        .filter(isHandleable)
        .forEach(cli => {
            const target = (clientScreens[screenCnt] || {})[cli] ?? 0; // Use primary screen (0) by default
            if (target != cli.screen) {
                log('sending', cli.resourceName, 'from', cli.screen, 'to', target);
                workspace.sendClientToScreen(cli, target);
            }
        });
};


const registerClient = cli => {
    if (!isHandleable(cli)) return;
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

