// Desktop shell: shows the built site (dist/) in a window. It never touches the network, so everything stays on this computer.
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit(); // two windows would overwrite each other's saved work

let win;
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  // offline by construction: refuse every request that is not one of the app's own files
  session.defaultSession.webRequest.onBeforeRequest((d, done) => done({ cancel: !/^(file|blob|data|devtools):/.test(d.url) }));

  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 560, backgroundColor: '#ffffff', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault()); // the app is one page; a dropped file must not replace it
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // `npm run desktop:check`: prove the page works from disk and cannot reach the network, then quit
  if (process.env.DESKTOP_CHECK) {
    const r = await win.webContents.executeJavaScript(`new Promise((done) => setTimeout(async () => done({
      total: document.querySelector('.hero .num')?.textContent ?? '',
      font: await document.fonts.ready.then(() => document.fonts.check("16px 'Figtree Variable'")),
      network: await fetch('https://example.com').then(() => 'reached', () => 'blocked'),
      saved: (() => { try { localStorage.setItem('check', '1'); localStorage.removeItem('check'); return true; } catch { return false; } })(),
      shareButton: !!document.querySelector('[data-a=share]'),
    }), 900))`);
    console.log(JSON.stringify(r));
    app.exit(r.total && r.font && r.network === 'blocked' && r.saved ? 0 : 1);
  }
});
