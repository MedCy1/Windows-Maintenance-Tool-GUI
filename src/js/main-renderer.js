const { ipcRenderer } = require('electron');

// État global de l'application
const AppState = {
    currentCategory: 'updates',
    isExecuting: false,
    outputCollapsed: false,
    commands: {}
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
        // Afficher seulement si ce n'est pas vide et pas un doublon
        if (data && data.trim()) {
            addOutputLine(`🔄 ${data}`, 'info');
        }
    });

    ipcRenderer.on('command-error', (event, data) => {
        // Afficher les erreurs en temps réel
        if (data && data.trim()) {
            addOutputLine(`⚠️ ${data}`, 'warning');
        }
    });
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