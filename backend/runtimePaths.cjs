const fs = require('fs');
const path = require('path');

const resolveEnvPath = (value, fallback) => path.resolve(value || fallback);

const storageDir = resolveEnvPath(
  process.env.PRIME_ERP_STORAGE_DIR,
  path.join(__dirname, 'storage')
);
const backupDir = resolveEnvPath(
  process.env.PRIME_ERP_BACKUP_DIR,
  path.join(storageDir, 'backups')
);
const tempDir = resolveEnvPath(
  process.env.PRIME_ERP_TEMP_DIR,
  path.join(storageDir, 'temp')
);
const secureKeysDir = resolveEnvPath(
  process.env.PRIME_ERP_SECURE_KEYS_DIR,
  path.join(storageDir, 'secure', 'keys')
);
const dbPath = resolveEnvPath(
  process.env.DB_PATH,
  path.join(storageDir, 'database.db')
);
const workspaceConfigPath = resolveEnvPath(
  process.env.PRIME_ERP_WORKSPACE_CONFIG,
  path.join(storageDir, 'workspace.json')
);
const licensePath = resolveEnvPath(
  process.env.PRIME_ERP_LICENSE_PATH,
  path.join(storageDir, 'license.json')
);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const ensureRuntimeDirs = () => {
  [
    storageDir,
    backupDir,
    tempDir,
    secureKeysDir,
    path.dirname(dbPath),
    path.dirname(workspaceConfigPath),
    path.dirname(licensePath),
  ].forEach(ensureDir);
};

module.exports = {
  storageDir,
  backupDir,
  tempDir,
  secureKeysDir,
  dbPath,
  workspaceConfigPath,
  licensePath,
  ensureDir,
  ensureRuntimeDirs,
};
