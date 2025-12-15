/**
 * Tauri utility functions
 * Detects if running in Tauri and provides Tauri-specific functionality
 */

// Check if running in Tauri
export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Get Tauri API if available
export const getTauriAPI = async () => {
  if (isTauri()) {
    try {
      return await import('@tauri-apps/api');
    } catch (error) {
      console.warn('Tauri API not available:', error);
      return null;
    }
  }
  return null;
};

