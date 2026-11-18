// Steam용 데스크톱 실행 파일 (Electron). 게임 자체는 index.html 그대로 띄움
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    backgroundColor: '#0d0b09', title: 'Prison of Calligraphy', show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // F11: 전체 화면 켜고 끄기
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
