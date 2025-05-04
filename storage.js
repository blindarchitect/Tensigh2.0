// Storage service for Tensigh Pro
class MemoryStorage {
  static async initialize() {
    const data = await chrome.storage.local.get(['memories', 'tags', 'stats', 'settings', 'savedTabs', 'savedTabGroups']);
    
    // Initialize if not exists
    const initialState = {};
    if (!data.memories) {
      initialState.memories = [];
    }
    if (!data.tags) {
      initialState.tags = [];
    }
    if (!data.stats) {
      initialState.stats = {
        created: 0,
        reviewed: 0,
        streak: 0,
        lastReviewDate: null
      };
    }
    if (!data.settings) {
      initialState.settings = {
        defaultMode: "spacedRepetition",
        darkMode: false,
        reviewLimit: 20,
        backupEnabled: true,
        autoBackupInterval: 24, // hours
        autoBackupOnMemoryCreate: true // Changed: Default to true
      };
    } else if (data.settings.autoBackupOnMemoryCreate === undefined) {
        // Add the setting if upgrading from a version without it
        data.settings.autoBackupOnMemoryCreate = true; // Changed: Default to true
        initialState.settings = data.settings; // Mark settings to be updated
    }
    if (!data.savedTabs) {
      initialState.savedTabs = [];
    }
    if (!data.savedTabGroups) {
        initialState.savedTabGroups = [];
    }
    
    if (Object.keys(initialState).length > 0) {
        await chrome.storage.local.set(initialState);
        console.log("Initialized/Updated storage with:", initialState);
    }
  }

  static async createMemory(memory) {
    const { memories, tags, stats, settings } = await chrome.storage.local.get(['memories', 'tags', 'stats', 'settings']);
    
    const newMemory = {
      ...memory,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      nextReview: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 1,
      reviewCount: 0,
      lastReviewed: null,
      status: 'active'
    };

    const updatedMemories = [...memories, newMemory];
    const updatedTags = Array.from(new Set([...tags, ...(memory.tags || [])]));
    const updatedStats = {
        ...stats,
        created: (stats.created || 0) + 1
    };
    
    console.log("Attempting to save new memory:", JSON.stringify(newMemory, null, 2));
    
    await chrome.storage.local.set({
      memories: updatedMemories,
      tags: updatedTags,
      stats: updatedStats
      // Settings are not modified here
    });
    
    console.log("Memory created:", newMemory.id);

    // --- Trigger automatic backup if enabled --- 
    if (settings && settings.autoBackupOnMemoryCreate) {
        console.log("Auto-backup setting enabled, triggering backup...");
        try {
            const dataToExport = await MemoryStorage.exportAllData();
            dataToExport.settings = settings; 
            
            const jsonString = JSON.stringify(dataToExport, null, 2);
            
            // --- Use data URL instead of Blob/Object URL ---
            const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonString)}`;
            // --- End data URL change ---
            
            // Use a fixed filename for overwriting
            const filename = `tensigh-pro-auto-backup.json`; 

            chrome.downloads.download({
                url: dataUrl, 
                filename: filename, // Fixed filename
                saveAs: false, 
                conflictAction: 'overwrite' // Added to overwrite existing file
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error(`Auto-backup download/overwrite failed: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`Auto-backup download/overwrite started with ID: ${downloadId}`);
                }
            });

        } catch (backupError) {
            console.error("Error during automatic backup:", backupError);
        }
    }
    // --- End automatic backup trigger --- 

    return newMemory;
  }

  static async getMemories(options = {}) {
    const { memories } = await chrome.storage.local.get(['memories']);
    let filteredMemories = [...memories];

    // Apply filters
    if (options.tag) {
      filteredMemories = filteredMemories.filter(m => m.tags.includes(options.tag));
    }
    if (options.status) {
      filteredMemories = filteredMemories.filter(m => m.status === options.status);
    }
    if (options.readyForReview) {
      filteredMemories = filteredMemories.filter(m => 
        new Date(m.nextReview) <= new Date()
      );
    }

    return filteredMemories;
  }

  static async updateMemory(memoryId, updates) {
    const { memories } = await chrome.storage.local.get(['memories']);
    const updatedMemories = memories.map(m => 
      m.id === memoryId ? { ...m, ...updates } : m
    );

    await chrome.storage.local.set({ memories: updatedMemories });
    return updatedMemories.find(m => m.id === memoryId);
  }

  static async deleteMemory(memoryId) {
    const { memories, stats } = await chrome.storage.local.get(['memories', 'stats']);
    const updatedMemories = memories.filter(m => m.id !== memoryId);
    
    await chrome.storage.local.set({
      memories: updatedMemories,
      stats: {
        ...stats,
        created: Math.max(0, stats.created - 1)
      }
    });
  }

  static async getStats() {
    const { stats } = await chrome.storage.local.get(['stats']);
    return stats;
  }

  static async updateStats(updates) {
    const { stats } = await chrome.storage.local.get(['stats']);
    const newStats = { ...stats, ...updates };
    
    await chrome.storage.local.set({ stats: newStats });
    return newStats;
  }

  static async getSettings() {
    const { settings } = await chrome.storage.local.get(['settings']);
    return settings;
  }

  static async updateSettings(updates) {
    const { settings } = await chrome.storage.local.get(['settings']);
    const newSettings = { ...settings, ...updates };
    
    await chrome.storage.local.set({ settings: newSettings });
    return newSettings;
  }

  static async exportData() {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data, null, 2);
  }

  static async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  static async saveTab(tabData) {
    const { savedTabs } = await chrome.storage.local.get(['savedTabs']);
    
    const newSavedTab = {
      ...tabData, // Should contain title, url, favIconUrl
      id: Date.now().toString(),
      savedAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({
      savedTabs: [...savedTabs, newSavedTab]
    });
    
    return newSavedTab;
  }

  static async saveTabGroup(groupData) {
    const { savedTabGroups } = await chrome.storage.local.get(['savedTabGroups']);
    
    const newSavedGroup = {
      ...groupData, // Should contain originalGroupId, title, color, tabs array
      id: Date.now().toString(),
      savedAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({
      savedTabGroups: [...savedTabGroups, newSavedGroup]
    });
    
    console.log("Saved group:", newSavedGroup); // For debugging
    return newSavedGroup;
  }

  // Added: Get all saved tab groups
  static async getSavedTabGroups() {
    const { savedTabGroups } = await chrome.storage.local.get(['savedTabGroups']);
    return savedTabGroups || [];
  }

  // Added: Delete a specific saved tab group by its unique ID
  static async deleteSavedTabGroup(groupIdToDelete) {
    const { savedTabGroups } = await chrome.storage.local.get(['savedTabGroups']);
    const updatedGroups = (savedTabGroups || []).filter(group => group.id !== groupIdToDelete);
    
    await chrome.storage.local.set({
      savedTabGroups: updatedGroups
    });
    console.log(`Deleted saved group: ${groupIdToDelete}`);
  }

  // Added: Export all relevant data
  static async exportAllData() {
      const keysToExport = ['memories', 'tags', 'stats', 'settings', 'savedTabs', 'savedTabGroups'];
      const data = await chrome.storage.local.get(keysToExport);
      // Ensure all keys exist, even if empty, for a consistent export
      keysToExport.forEach(key => {
          if (data[key] === undefined) {
              // Initialize based on expected type (arrays or objects)
              if (key.endsWith('s') || key === 'tags') { // Heuristic for arrays
                 data[key] = []; 
              } else if (key === 'stats' || key === 'settings') { // Known objects
                 data[key] = {}; 
              }
          }
      });
      return data;
  }

  // Added: Import data, overwriting existing data
  static async importAllData(jsonData) {
    // Basic validation: Check if it's an object
    if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error("Invalid data format: Not an object.");
    }
    // Could add more specific checks here if needed (e.g., check for 'memories' array)
    
    // Clear existing keys first? Or just overwrite?
    // Overwriting is simpler and generally fine.
    await chrome.storage.local.set(jsonData);
    console.log("Data imported successfully.");
    // Re-initialize to ensure any default structures are respected if keys were missing,
    // although exportAllData tries to prevent missing keys.
    await MemoryStorage.initialize(); 
  }

  // Added: Export ONLY memories in a simplified format for external use
  static async exportMemoriesForExternal() {
      const { memories } = await chrome.storage.local.get(['memories']);
      if (!memories || memories.length === 0) {
          return []; // Return empty array if no memories
      }
      
      const externalFormatMemories = memories.map(m => ({
          front: m.front || '', // Default to empty string if missing
          back: m.back || '',
          tags: m.tags || [],
          sourceUrl: m.context?.url || null,
          sourceTitle: m.context?.title || null,
          createdAt: m.createdAt || null
          // Excluded: id, nextReview, easeFactor, interval, reviewCount, 
          // lastReviewed, status, full context object details
      }));
      
      return externalFormatMemories;
  }
}

// Initialize storage when the service is loaded
MemoryStorage.initialize();