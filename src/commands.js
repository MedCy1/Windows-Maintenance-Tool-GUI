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