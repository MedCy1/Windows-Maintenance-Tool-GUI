const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

// Garde une référence globale de l'objet window
let mainWindow;

function createWindow() {
    // Créer la fenêtre du navigateur
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        show: false, // Ne pas montrer jusqu'à ce que prêt
        frame: false,
        transparent: true, // Transparence pour effets
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    // Charger index.html
    mainWindow.loadFile('index.html');

    // Afficher quand prêt pour éviter le flash visuel
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Focus sur la fenêtre
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    });

    // Ouvrir DevTools seulement si explicitement demandé
    if (process.argv.includes('--devtools') || process.argv.includes('--debug')) {
        mainWindow.webContents.openDevTools();
    }

    // Émis quand la fenêtre est fermée
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Gérer les liens externes
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Cette méthode sera appelée quand Electron aura fini de s'initialiser
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Vérifier les privilèges administrateur
function isAdmin() {
    try {
        return new Promise((resolve) => {
            exec('net session', (error) => {
                resolve(!error);
            });
        });
    } catch (e) {
        return Promise.resolve(false);
    }
}

// Handler pour vérifier les privilèges administrateur
ipcMain.handle('check-admin-privileges', async () => {
    return await isAdmin();
});

// IPC Handlers pour communication avec le renderer
ipcMain.handle('execute-command', async (event, command, description) => {
    return new Promise((resolve, reject) => {
        console.log(`Exécution: ${description}`);
        console.log(`Commande: ${command}`);
        
        const process = exec(command, { 
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        let output = '';
        let error = '';
        
        process.stdout.on('data', (data) => {
            output += data;
            // Envoyer les données en temps réel
            event.sender.send('command-output', data.toString());
        });
        
        process.stderr.on('data', (data) => {
            error += data;
            event.sender.send('command-error', data.toString());
        });
        
        process.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output,
                error: error,
                code: code
            });
        });
        
        process.on('error', (err) => {
            reject(err);
        });
    });
});

// Handler pour les commandes spéciales qui nécessitent des privilèges
ipcMain.handle('execute-admin-command', async (event, command, description) => {
    return new Promise((resolve, reject) => {
        console.log(`Exécution admin: ${description}`);
        
        // Utiliser PowerShell avec élévation pour les commandes admin
        const psCommand = `Start-Process cmd -ArgumentList '/c ${command}' -Verb RunAs -Wait`;
        
        exec(`powershell.exe -Command "${psCommand}"`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            
            resolve({
                success: true,
                output: stdout,
                error: stderr
            });
        });
    });
});

// Handler pour ouvrir des dossiers/fichiers
ipcMain.handle('open-folder', async (event, folderPath) => {
    shell.openPath(folderPath);
});

// Handler pour obtenir des informations système
ipcMain.handle('get-system-info', async () => {
    return {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus()
    };
});

// Handler pour fermer l'application
ipcMain.handle('close-app', () => {
    app.quit();
});

// Handler pour minimiser l'application
ipcMain.handle('minimize-app', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

// Handler pour maximiser/restaurer l'application
ipcMain.handle('toggle-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    }
});

// Handler pour toggle DevTools
ipcMain.handle('toggle-devtools', () => {
    if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools();
        }
    }
});

// Gestion des erreurs non capturées (filtrer les erreurs DevTools normales)
process.on('uncaughtException', (error) => {
    // Ignorer les erreurs DevTools normales
    if (error.message && (
        error.message.includes('Autofill.enable') ||
        error.message.includes('DevTools') ||
        error.message.includes('chrome-devtools')
    )) {
        return;
    }
    console.error('Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    // Ignorer les rejections DevTools normales
    if (reason && reason.toString().includes('DevTools')) {
        return;
    }
    console.error('Promesse rejetée non gérée:', reason);
});