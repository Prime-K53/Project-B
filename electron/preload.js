/**
 * Secure preload script for Electron renderer process
 * 
 * SECURITY: This script uses contextBridge to expose ONLY minimal,
 * read-only APIs to the renderer. Node.js APIs (fs, child_process,
 * require) are strictly forbidden from direct renderer access.
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose minimal APIs to renderer via contextBridge
 * 
 * STRICTLY FORBIDDEN from exposure:
 * - fs (file system access)
 * - child_process (process spawning)
 * - require (module loading)
 * - full IPC access (only limited logging allowed)
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Get the backend URL for API requests
   * Uses IPC to get the runtime info from the main process
   * @returns {Promise<string>} The backend origin URL (e.g., http://127.0.0.1:39300)
   */
  getBackendUrl: async () => {
    try {
      const runtime = await ipcRenderer.invoke('desktop:get-runtime');
      return runtime?.backendUrl || '';
    } catch (e) {
      return '';
    }
  },

  /**
   * Safe logging bridge - allows renderer to send logs to main process
   * Only accepts plain objects with message property, no arbitrary IPC
   * @param {object} payload - Object with at least a 'message' property
   */
  log: (payload) => {
    // Validate payload to prevent arbitrary IPC abuse
    if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
      ipcRenderer.send('renderer-log', payload);
    }
  },
});