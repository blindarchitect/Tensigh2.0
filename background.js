// Import storage service
importScripts('storage.js');

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

  // Initialize storage
  await MemoryStorage.initialize();
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
            
            let paragraphElement = range.commonAncestorContainer;
            // If the common ancestor is a text node, get its parent element
            if (paragraphElement.nodeType === Node.TEXT_NODE) {
              paragraphElement = paragraphElement.parentElement;
            }
            
            // Basic check if we successfully found an element
            if (!paragraphElement || typeof paragraphElement.textContent === 'undefined') {
                // Fallback to the original selection's immediate parent if finding the paragraph failed
                // This might happen in complex DOM structures or if selection is not within standard text blocks.
                paragraphElement = range.startContainer.parentElement;
            }
            
            // Ensure we have a valid element before accessing properties
            const paragraphText = paragraphElement ? paragraphElement.textContent : '';
            const paragraphHtml = paragraphElement ? paragraphElement.outerHTML.slice(0, 1000) : ''; // Increased slice limit

            return {
              paragraphText: paragraphText, // Use this for the back of the card
              paragraphHtml: paragraphHtml // More context, potentially useful later
            };
          }
        });
        
        if (result?.result) {
          // Updated context properties
          context.paragraphText = result.result.paragraphText;
          context.paragraphHtml = result.result.paragraphHtml;
        }
      } catch (error) {
        console.log("Couldn't get detailed context:", error);
      }

      // Create memory using storage service
      const newMemory = await MemoryStorage.createMemory({
        front: info.selectionText.trim(),
        // Use the full paragraph text as the default back content
        back: (context.paragraphText || info.selectionText).trim(), 
        context: context, // Contains paragraphText and paragraphHtml now
        tags: []
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