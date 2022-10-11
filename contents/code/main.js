const DEBUG = false;
const UNDO_TRESHOLD_MS = 3000;

const clientScreens = {};
let history = [];
const screenChangeListeners = {}; // Function handles for disconnecting event listeners.


const log = (...params) => DEBUG && console.log('restoreToScreen::', params.join(' '));


const isHandleable = cli => cli.normalWindow;


const cleanHistory = () => {
    log('cleanHistory:before', history.length);
    history = history.filter(conf => conf.moved > Date.now() - UNDO_TRESHOLD_MS);
    log('cleanHistory:after', history.length);
};


const setScreen = cli => {
    log('setScreen:', cli.resourceName, 'config:', workspace.numScreens, 'client screen:', cli.screen);
    if (!clientScreens[workspace.numScreens]) clientScreens[workspace.numScreens] = {};

    cleanHistory();
    history.push({
        cli: String(cli),
        resourceName: cli.resourceName,
        numScreens: workspace.numScreens,
        screen: clientScreens[workspace.numScreens][cli] || 0,
        moved: Date.now()
    });

    clientScreens[workspace.numScreens][cli] = cli.screen;
    // log('state', JSON.stringify(clientScreens[workspace.numScreens], null, 2))
};


const onNumberScreensChanged = (screenCnt) => {
    log('onNumberScreensChanged', screenCnt);

    // Undo moves that happened within few seconds, because they were propably triggered by kwin itself prior to disconnecting a screen.
    cleanHistory();
    history
        .reverse()
        .forEach(conf => {
            log('Undoing previous setScreen:', conf.resourceName)
            clientScreens[conf.numScreens][conf.cli] = conf.screen
        });
    history = []; // History can be ditched after every move has been undone.

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

    history = history.filter(conf => conf.cli != cli);
};


workspace.clientList().forEach(registerClient);

workspace.clientAdded.connect(registerClient);
workspace.clientRemoved.connect(unregisterClient);
workspace.numberScreensChanged.connect(onNumberScreensChanged);