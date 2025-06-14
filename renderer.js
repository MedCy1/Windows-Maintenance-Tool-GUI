const { ipcRenderer } = require('electron');

// État global de l'application
const AppState = {
    currentCategory: 'updates',
    isExecuting: false,
    outputCollapsed: false,
    commands: {}
};

// Définition des commandes disponibles
const Commands = {
    // Mises à jour
    'winget-update': {
        command: 'winget upgrade --all --include-unknown',
        description: 'Mise à jour des applications Windows',
        requiresAdmin: false,
        category: 'updates'
    },

    // Santé système
    'sfc-scan': {
        command: 'sfc /scannow',
        description: 'Scan des fichiers système corrompus',
        requiresAdmin: true,
        category: 'health'
    },
    'dism-check': {
        command: 'dism /online /cleanup-image /checkhealth',
        description: 'Vérification de la santé Windows',
        requiresAdmin: true,
        category: 'health'
    },
    'dism-restore': {
        command: 'dism /online /cleanup-image /restorehealth',
        description: 'Réparation de la santé Windows',
        requiresAdmin: true,
        category: 'health'
    },

    // Réseau
    'dns-flush': {
        command: 'ipconfig /flushdns',
        description: 'Vidage du cache DNS',
        requiresAdmin: false,
        category: 'network'
    },
    'dns-google': {
        command: 'netsh interface ip set dns name="Wi-Fi" static 8.8.8.8 primary && netsh interface ip add dns name="Wi-Fi" 8.8.4.4 index=2',
        description: 'Configuration DNS Google (8.8.8.8)',
        requiresAdmin: true,
        category: 'network'
    },
    'dns-cloudflare': {
        command: 'netsh interface ip set dns name="Wi-Fi" static 1.1.1.1 primary && netsh interface ip add dns name="Wi-Fi" 1.0.0.1 index=2',
        description: 'Configuration DNS Cloudflare (1.1.1.1)',
        requiresAdmin: true,
        category: 'network'
    },
    'network-info': {
        command: 'ipconfig /all',
        description: 'Affichage des informations réseau',
        requiresAdmin: false,
        category: 'network'
    },
    'restart-adapters': {
        command: 'netsh interface set interface "Wi-Fi" admin=disable && timeout /t 3 && netsh interface set interface "Wi-Fi" admin=enable',
        description: 'Redémarrage des adaptateurs réseau',
        requiresAdmin: true,
        category: 'network'
    },
    'network-repair': {
        command: 'ipconfig /release && ipconfig /renew && ipconfig /flushdns && netsh winsock reset && netsh int ip reset',
        description: 'Réparation automatique du réseau',
        requiresAdmin: true,
        category: 'network'
    },

    // Nettoyage
    'disk-cleanup': {
        command: 'cleanmgr',
        description: 'Lancement du nettoyage de disque',
        requiresAdmin: false,
        category: 'cleanup'
    },
    'chkdsk': {
        command: 'echo List disk | diskpart',
        description: 'Scan d\'erreurs avancé (CHKDSK)',
        requiresAdmin: true,
        category: 'cleanup',
        customHandler: true
    },
    'temp-cleanup': {
        command: 'del /s /f /q "%temp%\\*.*" && del /s /f /q "C:\\Windows\\Temp\\*.*"',
        description: 'Suppression des fichiers temporaires',
        requiresAdmin: true,
        category: 'cleanup'
    },
    'registry-cleanup': {
        command: '',
        description: 'Nettoyage du registre (recommandations)',
        requiresAdmin: false,
        category: 'cleanup',
        customHandler: true
    },

    // Utilitaires
    'show-drivers': {
        command: `driverquery /v > "%USERPROFILE%\\Desktop\\Pilotes_${new Date().toISOString().slice(0,10)}.txt"`,
        description: 'Export de la liste des pilotes',
        requiresAdmin: false,
        category: 'utilities'
    },
    'windows-update-repair': {
        command: 'net stop wuauserv && net stop bits && net stop cryptsvc && net stop msiserver && ren "C:\\Windows\\SoftwareDistribution" "SoftwareDistribution.bak" && ren "C:\\Windows\\System32\\catroot2" "catroot2.bak" && net start wuauserv && net start bits && net start cryptsvc && net start msiserver',
        description: 'Réparation des composants Windows Update',
        requiresAdmin: true,
        category: 'utilities'
    },
    'system-report': {
        command: `systeminfo > "%USERPROFILE%\\Desktop\\Rapport_Systeme_${new Date().toISOString().slice(0,10)}.txt"`,
        description: 'Génération du rapport système complet',
        requiresAdmin: false,
        category: 'utilities'
    },
    'update-service-reset': {
        command: 'net stop wuauserv && net stop cryptsvc && net stop appidsvc && net stop bits && net start appidsvc && net start wuauserv && net start bits && net start cryptsvc',
        description: 'Reset des services Windows Update',
        requiresAdmin: true,
        category: 'utilities'
    },
    'routing-table': {
        command: `route print > "%USERPROFILE%\\Desktop\\Table_Routage_${new Date().toISOString().slice(0,10)}.txt"`,
        description: 'Export de la table de routage',
        requiresAdmin: false,
        category: 'utilities'
    }
};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('🚀 Initialisation de l\'application...');
    
    // Créer les particules d'arrière-plan
    createParticles();
    
    // Initialiser les gestionnaires d'événements
    setupEventListeners();
    
    // Afficher la première catégorie (sans message de log)
    showCategoryQuiet('updates');
    
    // Vérifier les privilèges et mettre à jour les informations système
    checkAdminPrivileges();
    updateSystemInfo();
    
    // Animation d'entrée
    document.body.classList.add('bounce-in');
    
    // Messages d'initialisation
    addOutputLine('🛠️ Windows Maintenance Tool V2.9.8 - Interface initialisée', 'welcome');
    addOutputLine('📋 Sélectionnez une catégorie dans la sidebar pour commencer', 'info');
    addOutputLine('⌨️ Raccourcis: F12=DevTools | Ctrl+L=Effacer | Ctrl+Shift+C=Copier', 'info');
    
    updateStatus('Prêt', 'success');
}

// Vérifier les privilèges administrateur
async function checkAdminPrivileges() {
    try {
        const isAdmin = await ipcRenderer.invoke('check-admin-privileges');
        
        if (isAdmin) {
            addOutputLine('✅ Privilèges administrateur : ACTIFS', 'success');
        } else {
            addOutputLine('⚠️ Privilèges administrateur : NON ACTIFS (certaines fonctions limitées)', 'warning');
            addOutputLine('💡 Astuce: Lancez en tant qu\'administrateur pour toutes les fonctionnalités', 'info');
        }
        
        return isAdmin;
    } catch (error) {
        addOutputLine('❌ Impossible de vérifier les privilèges administrateur', 'error');
        return false;
    }
}

// Créer les particules d'arrière-plan
function createParticles() {
    const container = document.getElementById('particles-container');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        container.appendChild(particle);
    }
}

// Configuration des gestionnaires d'événements
function setupEventListeners() {
    // Boutons de la barre de titre
    const closeBtn = document.getElementById('closeBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('close-app');
        });
    }
    
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('minimize-app');
        });
    }
    
    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('toggle-maximize');
        });
    }

    // Boutons de la sidebar
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            showCategory(category);
            
            // Mettre à jour l'état actif
            document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Boutons d'exécution des outils
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('execute-btn')) {
            const toolCard = e.target.closest('.tool-card');
            const commandKey = toolCard.dataset.command;
            
            if (commandKey && Commands[commandKey]) {
                executeCommand(commandKey);
            }
        }
    });

    // Panel de sortie
    const toggleOutputBtn = document.getElementById('toggleOutput');
    const clearOutputBtn = document.getElementById('clearOutput');
    const copyOutputBtn = document.getElementById('copyOutput');
    
    if (toggleOutputBtn) {
        toggleOutputBtn.addEventListener('click', toggleOutput);
    }
    
    if (clearOutputBtn) {
        clearOutputBtn.addEventListener('click', clearOutput);
    }
    
    if (copyOutputBtn) {
        copyOutputBtn.addEventListener('click', copyOutput);
    } else {
        console.warn('Bouton copyOutput non trouvé - vérifiez l\'HTML');
    }
    
    // Modal
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalOverlay = document.getElementById('modalOverlay');
    
    if (modalClose) {
        modalClose.addEventListener('click', hideModal);
    }
    
    if (modalCancel) {
        modalCancel.addEventListener('click', hideModal);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                hideModal();
            }
        });
    }

    // Écouter les données de sortie des commandes
    ipcRenderer.on('command-output', (event, data) => {
        addOutputLine(data, 'info');
    });

    ipcRenderer.on('command-error', (event, data) => {
        addOutputLine(data, 'error');
    });
}

// Afficher une catégorie d'outils
function showCategory(categoryName) {
    // Masquer toutes les catégories
    document.querySelectorAll('.tool-category').forEach(cat => {
        cat.classList.remove('active');
    });
    
    // Afficher la catégorie sélectionnée
    const category = document.getElementById(`${categoryName}-category`);
    if (category) {
        category.classList.add('active');
        AppState.currentCategory = categoryName;
        
        addOutputLine(`📂 Catégorie "${getCategoryName(categoryName)}" sélectionnée`, 'info');
    }
}

// Afficher une catégorie sans message de log (pour l'initialisation)
function showCategoryQuiet(categoryName) {
    // Masquer toutes les catégories
    document.querySelectorAll('.tool-category').forEach(cat => {
        cat.classList.remove('active');
    });
    
    // Afficher la catégorie sélectionnée
    const category = document.getElementById(`${categoryName}-category`);
    if (category) {
        category.classList.add('active');
        AppState.currentCategory = categoryName;
    }
}

// Obtenir le nom français de la catégorie
function getCategoryName(key) {
    const names = {
        'updates': 'Mises à jour',
        'health': 'Santé système',
        'network': 'Outils réseau',
        'cleanup': 'Nettoyage',
        'utilities': 'Utilitaires',
        'support': 'Support'
    };
    return names[key] || key;
}

// Exécuter une commande
async function executeCommand(commandKey) {
    if (AppState.isExecuting) {
        showNotification('Une commande est déjà en cours d\'exécution', 'warning');
        return;
    }

    const cmd = Commands[commandKey];
    if (!cmd) {
        showNotification('Commande non trouvée', 'error');
        return;
    }

    // Gestion des commandes personnalisées
    if (cmd.customHandler) {
        handleCustomCommand(commandKey);
        return;
    }

    // Confirmation pour les commandes sensibles
    if (cmd.requiresAdmin) {
        const confirmed = await showConfirmModal(
            'Privilèges administrateur requis',
            `Cette opération nécessite des privilèges administrateur : ${cmd.description}\n\nVoulez-vous continuer ?`
        );
        
        if (!confirmed) {
            return;
        }
    }

    AppState.isExecuting = true;
    updateStatus(`Exécution: ${cmd.description}`, 'working');
    setProgress(10);

    addOutputLine(`🚀 Démarrage: ${cmd.description}`, 'command');
    addOutputLine(`💻 Commande: ${cmd.command}`, 'info');

    try {
        setProgress(30);
        
        let result;
        if (cmd.requiresAdmin) {
            result = await ipcRenderer.invoke('execute-admin-command', cmd.command, cmd.description);
        } else {
            result = await ipcRenderer.invoke('execute-command', cmd.command, cmd.description);
        }

        setProgress(80);

        if (result.success) {
            addOutputLine(`✅ Terminé: ${cmd.description}`, 'success');
            if (result.output && result.output.trim()) {
                addOutputLine(`📄 Résultat:`, 'info');
                addOutputLine(result.output, 'info');
            }
            showNotification('Commande exécutée avec succès', 'success');
        } else {
            addOutputLine(`❌ Erreur lors de l'exécution: ${cmd.description}`, 'error');
            if (result.error) {
                addOutputLine(`📄 Erreur: ${result.error}`, 'error');
            }
            showNotification('Erreur lors de l\'exécution', 'error');
        }

        setProgress(100);
        setTimeout(() => {
            updateStatus('Prêt', 'success');
            setProgress(0);
        }, 1000);

    } catch (error) {
        addOutputLine(`❌ Erreur fatale: ${error.message}`, 'error');
        showNotification('Erreur fatale lors de l\'exécution', 'error');
        
        updateStatus('Erreur', 'error');
        setProgress(0);
    } finally {
        AppState.isExecuting = false;
        addOutputLine('─'.repeat(60), 'info');
    }
}

// Gestion des commandes personnalisées
function handleCustomCommand(commandKey) {
    switch (commandKey) {
        case 'chkdsk':
            handleChkdskCommand();
            break;
        case 'registry-cleanup':
            handleRegistryCleanup();
            break;
        default:
            addOutputLine(`❌ Gestionnaire personnalisé non trouvé pour: ${commandKey}`, 'error');
    }
}

// Gestionnaire CHKDSK personnalisé
async function handleChkdskCommand() {
    const confirmed = await showConfirmModal(
        'CHKDSK - Scan d\'erreurs',
        'Cette opération va scanner tous vos disques à la recherche d\'erreurs.\nCela peut prendre beaucoup de temps.\n\nVoulez-vous continuer ?'
    );
    
    if (!confirmed) return;

    AppState.isExecuting = true;
    updateStatus('Scan CHKDSK en cours...', 'working');
    
    addOutputLine('🔍 Démarrage du scan CHKDSK sur tous les disques', 'command');
    
    try {
        // Obtenir la liste des disques
        const result = await ipcRenderer.invoke('execute-command', 'wmic logicaldisk get size,freespace,caption', 'Liste des disques');
        
        if (result.success && result.output) {
            addOutputLine('📀 Disques détectés:', 'info');
            addOutputLine(result.output, 'info');
            
            // Simuler l'exécution CHKDSK (en réalité, CHKDSK nécessite un redémarrage)
            addOutputLine('⚠️ Note: CHKDSK complet nécessite un redémarrage système', 'warning');
            addOutputLine('💡 Utilisation: chkdsk C: /f /r (remplacez C: par votre disque)', 'info');
            
            showNotification('Informations CHKDSK affichées', 'info');
        }
    } catch (error) {
        addOutputLine(`❌ Erreur: ${error.message}`, 'error');
        showNotification('Erreur lors de l\'analyse des disques', 'error');
    } finally {
        AppState.isExecuting = false;
        updateStatus('Prêt', 'success');
    }
}

// Gestionnaire nettoyage registre
function handleRegistryCleanup() {
    addOutputLine('📝 === NETTOYAGE DU REGISTRE ===', 'warning');
    addOutputLine('⚠️  Le nettoyage du registre est une opération très sensible', 'warning');
    addOutputLine('💡 Recommandations:', 'info');
    addOutputLine('   • Utilisez l\'outil intégré Windows "regedit"', 'info');
    addOutputLine('   • Créez toujours une sauvegarde avant modification', 'info');
    addOutputLine('   • Utilisez des outils spécialisés comme CCleaner', 'info');
    addOutputLine('   • Évitez les modifications manuelles si vous n\'êtes pas expert', 'info');
    addOutputLine('🔒 Pour votre sécurité, aucune modification automatique n\'est effectuée', 'success');
    
    showNotification('Recommandations de sécurité affichées', 'info');
    updateStatus('Recommandations affichées', 'success');
}

// Utilitaires d'interface
function addOutputLine(text, type = 'info') {
    const outputContent = document.getElementById('outputContent');
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = text;
    
    outputContent.appendChild(line);
    outputContent.scrollTop = outputContent.scrollHeight;
    
    // Limiter le nombre de lignes (performance)
    const lines = outputContent.querySelectorAll('.output-line');
    if (lines.length > 500) {
        lines[0].remove();
    }
}

function updateStatus(text, status = 'success') {
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    
    statusText.textContent = text;
    
    statusIndicator.className = `status-indicator ${status}`;
}

function setProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = percent + '%';
}

function toggleOutput() {
    const panel = document.getElementById('outputPanel');
    const btn = document.getElementById('toggleOutput');
    
    panel.classList.toggle('collapsed');
    btn.textContent = panel.classList.contains('collapsed') ? '▲' : '▼';
    AppState.outputCollapsed = panel.classList.contains('collapsed');
}

function clearOutput() {
    const outputContent = document.getElementById('outputContent');
    outputContent.innerHTML = '';
    addOutputLine('🗑️ Sortie effacée', 'info');
}

function copyOutput() {
    const outputContent = document.getElementById('outputContent');
    const lines = outputContent.querySelectorAll('.output-line');
    const text = Array.from(lines).map(line => line.textContent).join('\n');
    
    if (text.trim()) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Contenu copié dans le presse-papiers', 'success');
        }).catch((err) => {
            console.error('Erreur lors de la copie:', err);
            // Fallback pour les anciens navigateurs
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Contenu copié dans le presse-papiers', 'success');
        });
    } else {
        showNotification('Aucun contenu à copier', 'warning');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Suppression automatique
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showModal(title, content) {
    const modal = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    modalTitle.textContent = title;
    modalContent.textContent = content;
    
    modal.classList.add('show');
}

function hideModal() {
    const modal = document.getElementById('modalOverlay');
    modal.classList.remove('show');
}

function showConfirmModal(title, content) {
    return new Promise((resolve) => {
        showModal(title, content);
        
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            hideModal();
        };
        
        const onConfirm = () => {
            cleanup();
            resolve(true);
        };
        
        const onCancel = () => {
            cleanup();
            resolve(false);
        };
        
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

async function updateSystemInfo() {
    try {
        const sysInfo = await ipcRenderer.invoke('get-system-info');
        const statusRight = document.getElementById('systemInfo');
        statusRight.textContent = `${sysInfo.platform} ${sysInfo.arch} - ${sysInfo.hostname}`;
        
        // Affichage compact des infos système
        addOutputLine(`💻 Système: ${sysInfo.platform} ${sysInfo.release} (${sysInfo.arch}) | Machine: ${sysInfo.hostname} | RAM: ${Math.round(sysInfo.totalMemory / 1024 / 1024 / 1024)} GB`, 'info');
        
    } catch (error) {
        console.error('Erreur lors de la récupération des informations système:', error);
        addOutputLine('⚠️ Impossible de récupérer les informations système', 'warning');
    }
}

// Gestionnaire de raccourcis clavier
document.addEventListener('keydown', (e) => {
    // Ctrl+Q pour quitter
    if (e.ctrlKey && e.key === 'q') {
        ipcRenderer.invoke('close-app');
    }
    
    // Ctrl+L pour effacer la sortie
    if (e.ctrlKey && e.key === 'l') {
        clearOutput();
    }
    
    // Ctrl+Shift+C pour copier tout l'output
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copyOutput();
    }
    
    // F12 ou Ctrl+Shift+I pour toggle DevTools
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        ipcRenderer.invoke('toggle-devtools');
    }
    
    // F11 pour basculer en plein écran
    if (e.key === 'F11') {
        ipcRenderer.invoke('toggle-maximize');
    }
    
    // Échap pour fermer la modal
    if (e.key === 'Escape') {
        hideModal();
    }
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur JavaScript:', e.error);
    addOutputLine(`❌ Erreur JavaScript: ${e.error.message}`, 'error');
});

// Nettoyage à la fermeture
window.addEventListener('beforeunload', () => {
    console.log('👋 Fermeture de l\'application...');
});