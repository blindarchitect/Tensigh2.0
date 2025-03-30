class StudyModeManager {
  constructor() {
    this.modes = {
      spacedRepetition: new SpacedRepetitionMode(),
      activeRecall: new ActiveRecallMode(),
      interleaved: new InterleavedMode(),
      pomodoro: new PomodoroMode(),
      mindmap: new MindMapMode()
    };
    this.currentMode = null;
  }

  async activateMode(modeName, tabId) {
    this.currentMode = this.modes[modeName];
    const url = chrome.runtime.getURL(`${modeName}.html`);
    await chrome.tabs.create({ url, active: true });
    return this.currentMode;
  }

  getRecommendedMode() {
    // Simple recommendation engine
    const { memories, studySessions } = await chrome.storage.local.get(
      ['memories', 'studySessions']
    );
    
    const dueCount = memories.filter(m => 
      new Date(m.metadata.nextReview) <= new Date()
    ).length;
    
    if (dueCount > 10) return 'spacedRepetition';
    if (studySessions.length % 3 === 0) return 'interleaved';
    return 'activeRecall';
  }
}

class SpacedRepetitionMode {
  async getSessionMemories() {
    const { memories } = await chrome.storage.local.get('memories');
    return memories
      .filter(m => new Date(m.metadata.nextReview) <= new Date())
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);
  }

  async recordReview(memoryId, performanceRating) {
    const { memories } = await chrome.storage.local.get('memories');
    const memory = memories.find(m => m.id === memoryId);
    memory.calculateNextReview(performanceRating);
    await chrome.storage.local.set({ memories });
  }
}

// Other mode classes would follow similar patterns