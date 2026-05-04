const fs = require('fs');
const path = require('path');
const os = require('os');
const { workspaceConfigPath, dbPath, ensureRuntimeDirs } = require('../runtimePaths.cjs');

class WorkspaceService {
  constructor() {
    this.workspaceConfigPath = workspaceConfigPath;
  }

  async initializeWorkspace(companyName) {
    // Determine the user's Desktop path (works on Windows, macOS, and Linux)
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const workspacePath = path.join(desktopPath, `PrimeERP - ${companyName}`);

    const subfolders = [
      'Documents',
      'Invoices',
      'Receipts',
      'Backups',
      'Sync',
      'Exports'
    ];

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    subfolders.forEach(folder => {
      const folderPath = path.join(workspacePath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    });

    const config = {
      workspacePath,
      companyName,
      initializedAt: new Date().toISOString()
    };

    // Ensure storage dir exists
    ensureRuntimeDirs();

    fs.writeFileSync(this.workspaceConfigPath, JSON.stringify(config, null, 2));

    // Copy existing database to the workspace if it exists
    try {
      const sourceDb = dbPath;
      const targetDb = path.join(workspacePath, path.basename(dbPath));
      if (fs.existsSync(sourceDb) && !fs.existsSync(targetDb)) {
        fs.copyFileSync(sourceDb, targetDb);
        console.log('[Workspace] Existing database migrated to workspace.');
      }
    } catch (dbErr) {
      console.warn('[Workspace] Could not copy existing database:', dbErr);
    }

    return config;
  }

  getWorkspaceConfig() {
    if (fs.existsSync(this.workspaceConfigPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.workspaceConfigPath, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async saveToWorkspace(folder, filename, data) {
    const config = this.getWorkspaceConfig();
    if (!config || !config.workspacePath) {
      throw new Error('Workspace not initialized');
    }

    const targetDir = path.join(config.workspacePath, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, filename);
    
    // Check if data is base64 (e.g. for PDFs)
    let content = data;
    if (typeof data === 'string' && data.startsWith('data:')) {
      // Extract base64
      const base64Data = data.split(',')[1];
      content = Buffer.from(base64Data, 'base64');
    } else if (typeof data === 'object' && data !== null) {
      content = JSON.stringify(data, null, 2);
    }

    fs.writeFileSync(targetPath, content);
    return targetPath;
  }
}

module.exports = new WorkspaceService();
