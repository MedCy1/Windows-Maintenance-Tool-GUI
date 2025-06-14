const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const iconv = require('iconv-lite');
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

    mainWindow.loadFile('src/index.html');

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

        let child;
        if (process.platform === 'win32') {
            // /U : force UTF-16LE, /C : exécute puis ferme
            child = spawn('cmd', ['/U', '/C', command], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } else {
            const args = command.split(' ');
            const cmd = args.shift();
            child = spawn(cmd, args, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
        }

        let output = '';
        let error = '';
        let hasOutput = false;

        child.stdout.on('data', (data) => {
            const text = process.platform === 'win32'
                ? data.toString('utf16le')
                : data.toString('utf8');
            output += text;
            hasOutput = true;

            const lines = text.split(/\r?\n/).filter(line => line.trim());
            lines.forEach(line => event.sender.send('command-output', line.trim()));
        });

        // Capturer stderr en temps réel
        child.stderr.on('data', (data) => {
            const text = process.platform === 'win32'
                ? data.toString('utf16le')
                : data.toString('utf8');
            error += text;
            hasOutput = true;

            const lines = text.split(/\r?\n/).filter(line => line.trim());
            lines.forEach(line => event.sender.send('command-error', line.trim()));
        });

        // Fin du processus
        child.on('close', (code) => {
            setTimeout(() => {
                resolve({
                    success: code === 0 || code === null,
                    output: output.trim(),
                    error: error.trim(),
                    code: code,
                    hasRealTimeOutput: hasOutput
                });
            }, 100);
        });

        // Erreur du processus
        child.on('error', (err) => {
            console.error('Erreur processus:', err);
            event.sender.send('command-error', `Erreur: ${err.message}`);
            reject(err);
        });

        // Timeout de sécurité (30 minutes)
        setTimeout(() => {
            if (!child.killed) {
                child.kill();
                event.sender.send('command-error', 'Commande interrompue (timeout)');
                resolve({
                    success: false,
                    output,
                    error: 'Timeout atteint',
                    code: -1
                });
            }
        }, 30 * 60 * 1000);
    });
});

// Handler pour les commandes admin – utilisation de cmd /U pour sortie UTF-16LE
ipcMain.handle('execute-admin-command', async (event, command, description) => {
    return new Promise((resolve, reject) => {
        console.log(`Exécution admin: ${description}`);

        const tempFile      = path.join(os.tmpdir(), `wmt_output_${Date.now()}.txt`);
        const tempErrorFile = path.join(os.tmpdir(), `wmt_error_${Date.now()}.txt`);

        const wrappedCmd = `${command} > "${tempFile}" 2> "${tempErrorFile}"`;

        const psCommand = [
            'Start-Process', 'cmd',
            '-ArgumentList', `'/U','/C','${ wrappedCmd.replace(/'/g, "''") }'`,
            '-Verb', 'RunAs',
            '-Wait',
            '-WindowStyle', 'Hidden'
        ].join(' ');

        const proc = spawn('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            psCommand
        ], {
            stdio: ['pipe','pipe','pipe']
        });

        proc.on('error', err => {
            console.error('Erreur PowerShell:', err);
            event.sender.send('command-error', `Erreur PowerShell: ${err.message}`);
            reject(err);
        });

        proc.on('close', code => {
            // Lecture des fichiers en UTF-16LE
            const fs = require('fs');
            setTimeout(() => {
                let output = '';
                let error  = '';
                let hasRealTimeOutput = false;

                try {
                    if (fs.existsSync(tempFile)) {
                        // Le fichier contient du UTF-16LE émis par cmd /U
                        output = fs.readFileSync(tempFile, 'utf16le');
                        fs.unlinkSync(tempFile);
                        if (output.trim()) {
                            hasRealTimeOutput = true;
                            output.split(/\r?\n/).forEach(line => {
                                if (line.trim()) event.sender.send('command-output', line.trim());
                            });
                        }
                    }
                    if (fs.existsSync(tempErrorFile)) {
                        error = fs.readFileSync(tempErrorFile, 'utf16le');
                        fs.unlinkSync(tempErrorFile);
                        error.split(/\r?\n/).forEach(line => {
                            if (line.trim()) event.sender.send('command-error', line.trim());
                        });
                    }
                } catch (e) {
                    console.error('Erreur lecture fichiers temp:', e);
                    event.sender.send('command-error', `Erreur lecture fichier: ${e.message}`);
                    error += `\nErreur lecture fichier temporaire: ${e.message}`;
                }

                resolve({
                    success: code === 0,
                    output: output.trim(),
                    error:  error.trim(),
                    code,
                    hasRealTimeOutput
                });
            }, 500);
        });

        // Timeout (45 min)
        setTimeout(() => {
            if (!proc.killed) {
                proc.kill();
                event.sender.send('command-error', 'Commande interrompue (timeout)');
                resolve({
                    success: false,
                    output: '',
                    error: 'Timeout atteint',
                    code: -1,
                    hasRealTimeOutput: false
                });
            }
        }, 45 * 60 * 1000);
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