const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 960,
    minHeight: 640,
    title: 'Furigana Dubbing Studio — Apple Liquid Glass',
    titleBarStyle: 'hiddenInset', // Apple HIG macOS style titlebar
    vibrancy: 'ultra-dark',        // macOS Native Glass Vibrancy
    backgroundMaterial: 'acrylic', // Windows 11 Native Glass Acrylic
    backgroundColor: '#07070c',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load local Next.js server
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  win.loadURL(serverUrl).catch(() => {
    // Retry if server is still starting up
    setTimeout(() => win.loadURL(serverUrl), 1500);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
