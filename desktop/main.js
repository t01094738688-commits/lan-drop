const { app, BrowserWindow, Menu, Tray, shell, nativeImage, dialog } = require("electron");
const path = require("path");
const net = require("net");
const packageInfo = require("../package.json");

const APP_NAME = "闪传本子";
const APP_SUBTITLE = "LAN Drop";
const DATA_DIR_NAME = "闪传本子";
const APP_VERSION = packageInfo.version || "0.1.0";
const DEFAULT_PORT = Number(process.env.PORT || 47321);
const ICON_PATH = path.join(__dirname, "..", "build", "icon.ico");

let port = DEFAULT_PORT;
let mainWindow;
let tray;
let server;
let serverApi;
let closeToTrayRemembered = false;
let closeDialogOpen = false;

app.setName(APP_NAME);
app.setAppUserModelId("com.shanchuan.ben");
app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: APP_VERSION,
  version: APP_VERSION,
  copyright: "手机免安装的局域网互传工具",
  credits: `${APP_SUBTITLE} · 文件、图片、文字在同一 Wi-Fi 下快速互传`
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function appUrl() {
  return `http://localhost:${port}`;
}

function phoneUrl() {
  const addresses = serverApi.localAddresses();
  return addresses.length ? `http://${addresses[0]}:${port}` : appUrl();
}

function isPortFree(candidatePort) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(candidatePort, "0.0.0.0");
  });
}

async function findPort(startPort) {
  for (let candidate = startPort; candidate < startPort + 20; candidate += 1) {
    if (await isPortFree(candidate)) return candidate;
  }
  return 0;
}

function quitApp() {
  app.isQuitting = true;
  app.quit();
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow) return;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: `${APP_NAME} / ${APP_SUBTITLE} — v${APP_VERSION}`,
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(appUrl());

  mainWindow.on("close", async (event) => {
    if (app.isQuitting) return;

    event.preventDefault();
    if (closeToTrayRemembered) {
      hideToTray();
      return;
    }
    if (closeDialogOpen) return;

    closeDialogOpen = true;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: `关闭 ${APP_NAME}`,
      message: `要退出 ${APP_NAME}，还是先放到后台？`,
      detail: "放到后台后，手机仍然可以继续访问；要安装更新或彻底关闭，请选择“退出程序”。",
      buttons: ["放到后台", "退出程序", "取消"],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: "以后关闭窗口时直接放到后台",
      checkboxChecked: false
    });
    closeDialogOpen = false;

    if (choice.response === 0) {
      closeToTrayRemembered = choice.checkboxChecked;
      hideToTray();
    } else if (choice.response === 1) {
      quitApp();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip(`${APP_NAME} / ${APP_SUBTITLE} — v${APP_VERSION}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `打开 ${APP_NAME}`, click: showMainWindow },
      { label: `手机地址：${phoneUrl()}`, enabled: false },
      { label: "复制手机访问地址", click: () => require("electron").clipboard.writeText(phoneUrl()) },
      { label: "打开保存目录", click: () => shell.openPath(serverApi.INBOX_DIR) },
      { label: `关于 ${APP_NAME} v${APP_VERSION}`, role: "about" },
      { type: "separator" },
      { label: "退出程序", click: quitApp }
    ])
  );
  tray.on("double-click", showMainWindow);
}

app.on("second-instance", showMainWindow);

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    process.env.LAN_DROP_INBOX = path.join(app.getPath("documents"), DATA_DIR_NAME);
    serverApi = require("../server");
    port = await findPort(DEFAULT_PORT);
    server = serverApi.startServer({ port });
    createWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });
}

app.on("before-quit", () => {
  app.isQuitting = true;
  if (server) server.close();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

