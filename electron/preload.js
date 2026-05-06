/**
 * Secure preload script for Electron renderer process
 *
 * SECURITY: This script uses contextBridge to expose ONLY minimal,
 * read-only APIs to the renderer. Node.js APIs (fs, child_process,
 * require) are strictly forbidden from direct renderer access.
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Parse the backend origin injected by main.js via `additionalArguments`.
 * main.js passes: `--prime-backend-origin=http://127.0.0.1:<PORT>`
 * The preload runs in a Node.js context so process.argv is available here.
 */
const resolvedBackendOrigin = (() => {
  try {
    const arg = process.argv.find((a) => a.startsWith('--prime-backend-origin='));
    return arg ? arg.split('=').slice(1).join('=') : '';
  } catch {
    return '';
  }
})();

/**
 * Expose minimal APIs to renderer via contextBridge.
 *
 * STRICTLY FORBIDDEN from exposure:
 * - fs (file system access)
 * - child_process (process spawning)
 * - require (module loading)
 * - full IPC access (only limited logging allowed)
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Asynchronously retrieves the backend URL from the main process at runtime.
   * Prefer this for API calls that need the confirmed running origin.
   * @returns {Promise<string>} e.g. "http://127.0.0.1:3001"
   */
  getBackendUrl: async () => {
    try {
      const runtime = await ipcRenderer.invoke('desktop:get-runtime');
      return runtime?.backendUrl || resolvedBackendOrigin || '';
    } catch {
      return resolvedBackendOrigin || '';
    }
  },

  /**
   * Synchronous backend origin string, parsed directly from process.argv in
   * the preload. Available immediately (no await needed) for use cases like
   * font-URL safety checks that run at module load time.
   *
   * Value example: "http://127.0.0.1:3001"
   * Empty string when not running under Electron.
   */
  backendOrigin: resolvedBackendOrigin,

  /**
   * Safe logging bridge — allows renderer to send logs to the main process.
   * Only accepts plain objects with a `message` string property.
   * @param {{ message: string, [key: string]: unknown }} payload
   */
  log: (payload) => {
    if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
      ipcRenderer.send('renderer-log', payload);
    }
  },
});