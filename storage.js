// Storage service for Tensigh Pro
class MemoryStorage {
  static async initialize() {
    const data = await chrome.storage.local.get(['memories', 'tags', 'stats', 'settings']);
    
    // Initialize if not exists
    if (!data.memories) {
      await chrome.storage.local.set({
        memories: [],
        tags: [],
        stats: {
          created: 0,
          reviewed: 0,
          streak: 0,
          lastReviewDate: null
        },
        settings: {
          defaultMode: "spacedRepetition",
          darkMode: false,
          reviewLimit: 20,
          backupEnabled: true,
          autoBackupInterval: 24 // hours
        }
      });
    }
  }

  static async createMemory(memory) {
    const { memories, tags, stats } = await chrome.storage.local.get(['memories', 'tags', 'stats']);
    
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

    await chrome.storage.local.set({
      memories: [...memories, newMemory],
      tags: Array.from(new Set([...tags, ...(memory.tags || [])])),
      stats: {
        ...stats,
        created: stats.created + 1
      }
    });

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
}

// Initialize storage when the service is loaded
MemoryStorage.initialize();