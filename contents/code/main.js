const DEBUG = false;
const UNDO_TRESHOLD_MS = 3000;

const clientScreens = {};
let history = []; // Move history used for undoing moves that kwin does automatically
const screenChangeListeners = {}; // Function handles for disconnecting event listeners.


const log = (...params) => DEBUG && console.log('restoreToScreen::', params.join(' '));


const isHandleable = cli => cli.normalWindow;


const getScreenSetup = () => {
    // Hacky method to parse screen names and indexes from supportInformation
    const screens = (workspace.supportInformation().match(/Screen \d:(.|\n)+=====/)[0] || '')
        .split(/Screen/)
        .map(val => val.trim())
        .filter(Boolean)
        .reduce((res, cur) => Object.assign(res, { [cur[0]]: cur.match(/Name:.+\n/)[0].split(' ')[1].trim() }), {});

    return {
        getPrimary: () => screens[0],
        getScreen: (cli) => screens[cli.screen],
        getScreenNum: (screenName) => Object.entries(screens).find(([, name]) => name === screenName)[0],
        getLayoutId: () => Object.values(screens).join()
    };
}


const cleanHistory = () => {
    log('cleanHistory:before', history.length);
    history = history.filter(conf => conf.moved > Date.now() - UNDO_TRESHOLD_MS);
    log('cleanHistory:after', history.length);
};


const setScreen = cli => {
    const screens = getScreenSetup();
    const layoutId = screens.getLayoutId();
    log('setScreen:', cli.resourceName, 'config:', layoutId, 'client screen:', cli.screen, 'screenName', screens.getScreen(cli));
    if (!clientScreens[layoutId]) clientScreens[layoutId] = {};

    cleanHistory();
    history.push({
        cli: String(cli),
        resourceName: cli.resourceName,
        layoutId,
        screen: clientScreens[layoutId][cli] || screens.getPrimary(),
        moved: Date.now()
    });

    clientScreens[layoutId][cli] = screens.getScreen(cli);
    // log('state', JSON.stringify(clientScreens[layoutId], null, 2))
};


const onNumberScreensChanged = (screenCnt) => {
    const screens = getScreenSetup();
    log('onNumberScreensChanged', screenCnt, screens.getLayoutId());

    // Undo moves that happened within few seconds, because they were propably triggered by kwin itself prior to disconnecting a screen.
    cleanHistory();
    history
        .reverse()
        .forEach(conf => {
            log('Undoing previous setScreen:', conf.resourceName)
            clientScreens[conf.layoutId][conf.cli] = conf.screen
        });
    history = []; // History can be ditched after every move has been undone.
    
    // Restore windows to screens they were before.
    workspace.clientList()
        .filter(isHandleable)
        .forEach(cli => {
            const target = (clientScreens[screens.getLayoutId()] || {})[cli] ?? screens.getPrimary(); // Move to primary screen by default
            if (target != screens.getScreen(cli)) {
                log('sending', cli.resourceName, 'from', screens.getScreen(cli), 'to', target, ' (', screens.getScreenNum(target), ')');
                workspace.sendClientToScreen(cli, screens.getScreenNum(target));
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