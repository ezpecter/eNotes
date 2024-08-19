const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

function createWindow() {
    let windowConfig = { width: 800, height: 600, x: undefined, y: undefined };
    
    // Cargar la configuración guardada si existe
    if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        windowConfig = { ...windowConfig, ...savedConfig };
    }
    
    mainWindow = new BrowserWindow({
        ...windowConfig,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', () => {
        // Guardar el tamaño y la posición de la ventana antes de cerrar
        const { width, height, x, y } = mainWindow.getBounds();
        fs.writeFileSync(configPath, JSON.stringify({ width, height, x, y }));
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Enviar la ruta del archivo de notas al proceso de renderizado
    ipcMain.handle('get-notes-file-path', () => {
        return path.join(app.getPath('userData'), 'notes.json');
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});