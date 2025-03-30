// Initialize with professional features
chrome.runtime.onInstalled.addListener(async () => {
  // Clear existing context menus
  await chrome.contextMenus.removeAll();
  
  // Create context menu item
  chrome.contextMenus.create({
    id: "createMemory",
    title: "Create Memory in Tensigh Pro",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  });

  // Initialize storage with professional defaults
  await chrome.storage.local.set({
    memories: [],
    tags: [],
    stats: {
      created: 0,
      reviewed: 0,
      streak: 0
    },
    settings: {
      defaultMode: "spacedRepetition",
      darkMode: false,
      reviewLimit: 20
    }
  });
});

// Enhanced memory creation handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "createMemory" && info.selectionText) {
    try {
      // Get basic page context
      const context = {
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString()
      };

      // Try to get more context (works on most regular pages)
      try {
        const [result] = await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          func: () => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return null;
            const range = selection.getRangeAt(0);
            return {
              surroundingText: range.startContainer.textContent,
              htmlContext: range.startContainer.parentElement.outerHTML.slice(0, 500)
            };
          }
        });
        
        if (result?.result) {
          context.surroundingText = result.result.surroundingText;
          context.htmlContext = result.result.htmlContext;
        }
      } catch (error) {
        console.log("Couldn't get detailed context:", error);
      }

      // Create and save memory
      const { memories, tags, stats } = await chrome.storage.local.get(['memories', 'tags', 'stats']);
      
      const newMemory = {
        id: Date.now().toString(),
        front: info.selectionText.trim(),
        back: context.surroundingText || info.selectionText.trim(),
        context: context,
        tags: [],
        createdAt: new Date().toISOString(),
        nextReview: new Date().toISOString(),
        easeFactor: 2.5,
        interval: 1,
        reviewCount: 0
      };

      await chrome.storage.local.set({
        memories: [...memories, newMemory],
        tags: Array.from(new Set([...tags])),
        stats: {
          ...stats,
          created: stats.created + 1
        }
      });

      // Visual feedback
      chrome.action.setBadgeText({
        text: "✓",
        tabId: tab.id
      });
      setTimeout(() => {
        chrome.action.setBadgeText({
          text: "",
          tabId: tab.id
        });
      }, 1000);

    } catch (error) {
      console.error("Error creating memory:", error);
    }
  }
});