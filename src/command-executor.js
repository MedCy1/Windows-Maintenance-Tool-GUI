// Fonctions d'exécution des commandes

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

// Exécuter une commande - RETOUR À L'APPROCHE D'ORIGINE
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

    // Confirmation pour les commandes sensibles (approche d'origine)
    if (cmd.requiresAdmin) {
        const confirmed = await showConfirmModal(
            'Privilèges administrateur requis',
            `Cette opération nécessite des privilèges administrateur : ${cmd.description}\n\nWindows va vous demander de confirmer l'élévation.\n\nVoulez-vous continuer ?`
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
            addOutputLine('🔐 Demande d\'élévation des privilèges...', 'warning');
            result = await ipcRenderer.invoke('execute-admin-command', cmd.command, cmd.description);
        } else {
            result = await ipcRenderer.invoke('execute-command', cmd.command, cmd.description);
        }

        setProgress(80);

        if (result.success) {
            addOutputLine(`✅ Terminé: ${cmd.description}`, 'success');
            
            // Afficher la sortie seulement si elle n'a pas été affichée en temps réel
            if (!result.hasRealTimeOutput && result.output && result.output.trim()) {
                addOutputLine(`📄 Résultat final:`, 'info');
                result.output.split('\n').forEach(line => {
                    if (line.trim()) {
                        addOutputLine(line.trim(), 'info');
                    }
                });
            } else if (result.hasRealTimeOutput) {
                addOutputLine(`📄 Sortie affichée en temps réel ci-dessus`, 'info');
            }
            
            // Messages contextuels
            if (cmd.command.includes('sfc /scannow')) {
                addOutputLine(`💡 Note: Si un redémarrage est requis, redémarrez et relancez SFC`, 'warning');
            } else if (cmd.command.includes('dism')) {
                addOutputLine(`💡 DISM terminé - vérifiez les messages ci-dessus`, 'info');
            }
            
            showNotification('Commande exécutée avec succès', 'success');
        } else {
            addOutputLine(`❌ Erreur lors de l'exécution: ${cmd.description}`, 'error');
            
            if (result.error && result.error.trim()) {
                addOutputLine(`📄 Détails de l'erreur:`, 'error');
                result.error.split('\n').forEach(line => {
                    if (line.trim()) {
                        addOutputLine(line.trim(), 'error');
                    }
                });
            }
            
            // Messages d'aide simples
            if (cmd.requiresAdmin && result.code !== 0) {
                addOutputLine(`💡 L'élévation des privilèges a peut-être été refusée`, 'warning');
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