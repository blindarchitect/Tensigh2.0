// Import storage service
importScripts('storage.js');

// Global state
let activeGroupId = null;
let isSelecting = false;
let tabGroupCounter = 1;
let ctrlPressed = false;

// Color constants for badges
const COLORS = {
  LOADING: "#FFA500",   // Orange/Amber
  SUCCESS: "#2196F3"    // Blue
};

// Tab group colors
const GROUP_COLORS = [
  "blue", "cyan", "green", "orange", "pink", "purple", "red", "yellow", "grey"
];

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
            
            // Find the nearest block-level ancestor
            let container = range.startContainer;
            while (container && container.nodeType === Node.TEXT_NODE) {
              container = container.parentNode;
            }
            
            // Find the nearest paragraph or block-level element
            let blockElement = container;
            while (blockElement && 
                   blockElement.nodeType === Node.ELEMENT_NODE && 
                   !['P', 'DIV', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI'].includes(blockElement.tagName)) {
              blockElement = blockElement.parentNode;
            }
            
            // Get the text content of the block element
            const surroundingText = blockElement ? blockElement.textContent.trim() : range.startContainer.textContent;
            
            return {
              surroundingText: surroundingText,
              htmlContext: blockElement ? blockElement.outerHTML.slice(0, 500) : range.startContainer.parentElement.outerHTML.slice(0, 500),
              // Add scroll position
              scrollPosition: {
                x: window.scrollX,
                y: window.scrollY
              }
            };
          }
        });
        
        if (result?.result) {
          context.surroundingText = result.result.surroundingText;
          context.htmlContext = result.result.htmlContext;
          context.scrollPosition = result.result.scrollPosition;
        }
      } catch (error) {
        console.log("Couldn't get detailed context:", error);
      }

      // Create memory using storage service
      const newMemory = await MemoryStorage.createMemory({
        front: info.selectionText.trim(),
        back: context.surroundingText || info.selectionText.trim(),
        context: context,
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

// Handle tab activation - check for Ctrl key press
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Get the current tab
  const tab = await chrome.tabs.get(activeInfo.tabId);
  
  // If tab has URL and Ctrl is pressed, add to group
  if (tab.url && ctrlPressed) {
    addTabToGroup(tab);
  }
});

// Listen for keyboard events from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'keyEvent') {
    handleKeyEvent(message.key, message.type, sender.tab);
    sendResponse({success: true});
    return true;
  }
  
  // Handle tab loading status messages
  if (message.action === 'setTabLoading' && message.tabId) {
    setTabLoading(message.tabId);
    sendResponse({success: true});
    return true;
  }
  
  if (message.action === 'setTabLoaded' && message.tabId) {
    setTabLoaded(message.tabId);
    sendResponse({success: true});
    return true;
  }

  if (message.action === "getSelectedTabs") {
    // Get tabs from the active group
    getTabsFromActiveGroup().then(tabs => {
      sendResponse({ selectedTabs: tabs });
    });
    return true;
  }
  
  if (message.action === "saveTabsAsGroup") {
    saveTabsAsGroup().then(() => {
      sendResponse({success: true});
    }).catch(error => {
      console.error("Error saving tabs:", error);
      sendResponse({success: false, error: error.message});
    });
    return true;
  }
});

// Function to handle key events (Ctrl)
async function handleKeyEvent(key, eventType, tab) {
  if (!tab || !tab.url) return;
  
  // Handle Ctrl key press
  if (key === 'Control' && eventType === 'keydown') {
    ctrlPressed = true;
    
    // If no active group, create one with the current tab
    if (!activeGroupId) {
      const activeTabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (activeTabs.length > 0 && activeTabs[0].url) {
        await createNewGroup(activeTabs[0].id);
      }
    }
  }
  
  // Handle Ctrl key release
  if (key === 'Control' && eventType === 'keyup') {
    ctrlPressed = false;
  }
}

// Create a new tab group
async function createNewGroup(tabId) {
  try {
    // Create a new group with the tab
    activeGroupId = await chrome.tabs.group({
      tabIds: [tabId]
    });
    
    // Set the group properties
    await chrome.tabGroups.update(activeGroupId, {
      color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)],
      title: `Tab Group ${tabGroupCounter++}`,
      collapsed: false
    });
    
    return activeGroupId;
  } catch (error) {
    console.error("Error creating tab group:", error);
    return null;
  }
}

// Add a tab to the active group
async function addTabToGroup(tab) {
  if (!activeGroupId) {
    // Create a new group if none exists
    activeGroupId = await createNewGroup(tab.id);
  } else {
    try {
      // Check if the tab is already in a group
      const tabInfo = await chrome.tabs.get(tab.id);
      if (tabInfo.groupId === activeGroupId) {
        // Tab is already in this group, do nothing
        return;
      }
      
      // Add to existing group with retry mechanism
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Add to existing group
          await chrome.tabs.group({
            tabIds: [tab.id],
            groupId: activeGroupId
          });
          
          // Update group title with new count
          const groupTabs = await chrome.tabs.query({groupId: activeGroupId});
          await chrome.tabGroups.update(activeGroupId, {
            title: `Tab Group ${tabGroupCounter-1} (${groupTabs.length} tabs)`
          });
          
          // Success, break out of retry loop
          break;
        } catch (error) {
          retryCount++;
          
          // If it's the "tabs cannot be edited" error, wait and retry
          if (error.message.includes("Tabs cannot be edited right now") && retryCount < maxRetries) {
            // Wait a short time before retrying (increasing delay with each retry)
            await new Promise(resolve => setTimeout(resolve, 300 * retryCount));
            continue;
          }
          
          // For other errors or if we've exhausted retries, throw the error
          throw error;
        }
      }
    } catch (error) {
      console.error("Error adding tab to group:", error);
    }
  }
}

// Get tabs from the active group
async function getTabsFromActiveGroup() {
  if (!activeGroupId) {
    return [];
  }
  
  try {
    const tabs = await chrome.tabs.query({groupId: activeGroupId});
    return tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl
    }));
  } catch (error) {
    console.error("Error getting tabs from group:", error);
    return [];
  }
}

// Set badge to indicate loading state
async function setTabLoading(tabId) {
  await chrome.action.setBadgeText({
    text: "↻",
    tabId: tabId
  });
  
  await chrome.action.setBadgeBackgroundColor({
    color: COLORS.LOADING,
    tabId: tabId
  });
}

// Set badge to indicate successfully loaded
async function setTabLoaded(tabId) {
  await chrome.action.setBadgeText({
    text: "↺",
    tabId: tabId
  });
  
  await chrome.action.setBadgeBackgroundColor({
    color: COLORS.SUCCESS,
    tabId: tabId
  });
  
  // Clear the badge after 2 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({
      text: "",
      tabId: tabId
    });
  }, 2000);
}

// Listen for keyboard events globally
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_selection_mode") {
    try {
      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!activeTab) {
        console.log("No active tab found");
        return;
      }

      console.log("Active tab:", activeTab);

      // Check if the tab is in a group
      const groupId = activeTab.groupId;
      console.log("Tab group ID:", groupId);

      if (groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        console.log("Tab is in a group, saving...");
        // If in a group, save it
        activeGroupId = groupId;
        await saveTabsAsGroup();
      } else {
        console.log("Tab is not in a group");
        // Show notification that no group was found
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'No Tab Group',
          message: 'Please select a tab that is part of a Chrome tab group'
        });
      }
    } catch (error) {
      console.error("Error handling keyboard shortcut:", error);
    }
  }
});

// Save tabs as a group
async function saveTabsAsGroup() {
  console.log("Starting saveTabsAsGroup with activeGroupId:", activeGroupId);
  
  if (!activeGroupId) {
    console.log("No active group ID found");
    return;
  }
  
  try {
    // Get the group info first
    const groupInfo = await chrome.tabGroups.get(activeGroupId);
    console.log("Group info:", groupInfo);
    
    const tabs = await chrome.tabs.query({groupId: activeGroupId});
    console.log("Found tabs in group:", tabs);
    
    if (tabs.length === 0) {
      console.log("No tabs found in group");
      return;
    }
    
    const tabsToClose = [];
    const groupData = {
      tabs: [],
      createdAt: new Date().toISOString(),
      id: Date.now().toString(),
      groupName: groupInfo.title || `Tab Group ${tabGroupCounter-1}`
    };
    
    // First, get basic info for ALL tabs in the group
    for (const tab of tabs) {
      try {
        // Add this tab to the group with basic info
        groupData.tabs.push({
          url: tab.url,
          title: tab.title,
          scrollPosition: { x: 0, y: 0 },
          favicon: tab.favIconUrl || null
        });
        
        tabsToClose.push(tab.id);
      } catch (error) {
        console.error(`Error getting basic info for tab with URL ${tab.url}:`, error);
      }
    }
    
    console.log("Group data prepared:", groupData);
    
    // Only save if we have tabs in the group
    if (groupData.tabs.length > 0) {
      // Create a single memory entry for the entire tab group
      const newMemory = await MemoryStorage.createMemory({
        front: `Tab Group: ${groupData.groupName} (${groupData.tabs.length} tabs)`,
        back: groupData.tabs.map(tab => `${tab.title}: ${tab.url}`).join('\n\n'),
        context: {
          type: 'tabGroup',
          tabGroup: groupData,
          timestamp: new Date().toISOString()
        },
        tags: ['saved-tab', 'tab-group']
      });
      
      console.log("Memory created:", newMemory);
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Tab Group Saved',
        message: `${groupData.tabs.length} tab(s) saved as "${groupData.groupName}"`
      });
      
      // Show a green checkmark on the extension icon
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
      
      // Clear the badge after 2 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: "" });
      }, 2000);
      
      // Close all tabs in the group
      if (tabsToClose.length > 0) {
        try {
          // First, ungroup the tabs
          await chrome.tabs.ungroup(tabsToClose);
          // Then close them
          await chrome.tabs.remove(tabsToClose);
          console.log("Successfully closed tabs:", tabsToClose);
        } catch (error) {
          console.error("Error closing tabs:", error);
        }
      }
      
      // Clear the active group
      activeGroupId = null;
    }
  } catch (error) {
    console.error("Error in saveTabsAsGroup:", error);
  }
}

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // If we have an active group, check if it's empty
  if (activeGroupId) {
    const groupTabs = await chrome.tabs.query({groupId: activeGroupId});
    if (groupTabs.length === 0) {
      // Group is empty, clear it
      activeGroupId = null;
    }
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Get the current tab's group ID
    const currentTab = await chrome.tabs.get(tab.id);
    const groupId = currentTab.groupId;
    
    if (groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      // If the tab is in a group, save it
      activeGroupId = groupId;
      await saveTabsAsGroup();
    } else {
      // If no group, open the popup
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error("Error handling extension icon click:", error);
    // If there's an error, open the popup as fallback
    chrome.action.openPopup();
  }
});

// Inject a content script to listen for keyboard events in all tabs
async function injectKeyboardListeners() {
  // Get all tabs
  const tabs = await chrome.tabs.query({});
  
  // Inject content script into each tab
  for (const tab of tabs) {
    // Check if the URL is injectable - only inject into http/https URLs
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Remove any existing listeners first
            if (window.tensighKeyListenersActive) {
              document.removeEventListener('keydown', window.tensighKeyDownHandler);
              document.removeEventListener('keyup', window.tensighKeyUpHandler);
            }
            
            // Create new handlers
            window.tensighKeyDownHandler = (e) => {
              if (e.key === 'Control') {
                chrome.runtime.sendMessage({
                  action: 'keyEvent',
                  key: e.key,
                  type: 'keydown'
                });
              }
            };
            
            window.tensighKeyUpHandler = (e) => {
              if (e.key === 'Control') {
                chrome.runtime.sendMessage({
                  action: 'keyEvent',
                  key: e.key,
                  type: 'keyup'
                });
              }
            };
            
            // Add new listeners
            document.addEventListener('keydown', window.tensighKeyDownHandler);
            document.addEventListener('keyup', window.tensighKeyUpHandler);
            window.tensighKeyListenersActive = true;
          }
        });
      } catch (error) {
        // Only log errors for non-chrome:// URLs to reduce noise
        if (!tab.url.startsWith('chrome://')) {
          console.log(`Could not inject keyboard listeners into tab ${tab.id}:`, error);
        }
      }
    }
  }
}

// Inject keyboard listeners when the extension starts
chrome.runtime.onStartup.addListener(() => {
  injectKeyboardListeners();
});

// Also inject keyboard listeners when installed
chrome.runtime.onInstalled.addListener(() => {
  injectKeyboardListeners();
});

// Inject keyboard listeners when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  // Wait for the tab to finish loading
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === tab.id && info.status === 'complete') {
      if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        injectKeyboardListeners();
      }
      chrome.tabs.onUpdated.removeListener(listener);
    }
  });
});