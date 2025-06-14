// Fonctions d'interface utilisateur

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

// Utilitaires d'interface
function addOutputLine(text, type = 'info') {
    const outputContent = document.getElementById('outputContent');
    
    // Éviter les doublons exacts récents (dernières 3 lignes)
    const lastLines = Array.from(outputContent.querySelectorAll('.output-line'))
        .slice(-3)
        .map(line => line.textContent);
    
    if (lastLines.includes(text)) {
        return;
    }
    
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