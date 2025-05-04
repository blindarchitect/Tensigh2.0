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
            let range = null;
            let startNode = document.body; // Default
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
                startNode = range.startContainer;
            }
            
            // --- Improved Find Paragraph Context --- 
            let paragraphElement = null;
            let currentNode = startNode;
            const blockElements = ['P', 'DIV', 'LI', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
            let levels = 0;

            while (currentNode && currentNode !== document.body && levels < 10) {
                // If the node is a text node, check its parent first
                let checkNode = (currentNode.nodeType === Node.TEXT_NODE) ? currentNode.parentElement : currentNode;

                if (checkNode && blockElements.includes(checkNode.nodeName)) {
                    // Found a likely block-level container
                    paragraphElement = checkNode;
                    break; // Stop searching upwards
                }
                
                // Move up to the parent
                currentNode = currentNode.parentElement;
                levels++;
            }

            // Fallback if no suitable block element found nearby
            if (!paragraphElement) {
                // If startNode was text, its parent might be the best we have
                if (startNode.nodeType === Node.TEXT_NODE && startNode.parentElement) {
                    paragraphElement = startNode.parentElement;
                } else if (startNode.nodeType === Node.ELEMENT_NODE) {
                    // Or maybe the start node itself if it was an element
                    paragraphElement = startNode; 
                } else {
                    // Final fallback: the initial common ancestor's parent if possible
                    paragraphElement = range ? (range.commonAncestorContainer.parentElement || range.commonAncestorContainer) : document.body;
                }
                 // Ensure we have an actual element, not just the document body unless necessary
                 if (!paragraphElement || paragraphElement === document.body && document.body.textContent.length > 2000) {
                     paragraphElement = range ? range.startContainer.parentElement : document.body;
                 }
                 console.log('Using fallback paragraph element:', paragraphElement ? paragraphElement.nodeName : 'null');
            }

            const paragraphText = paragraphElement ? paragraphElement.textContent.trim().replace(/\s+/g, ' ') : ''; // Trim and normalize whitespace
            const paragraphHtml = paragraphElement ? paragraphElement.outerHTML.slice(0, 1500) : ''; // Slightly more HTML context
            // --- End Improved Find Paragraph Context --- 

            // --- Find Image URL --- 
            let imageUrl = null;
            
            // 1. Try Open Graph Meta Tag
            try {
                const ogImageMeta = document.querySelector('meta[property="og:image"]');
                if (ogImageMeta && ogImageMeta.content) {
                    imageUrl = new URL(ogImageMeta.content, document.baseURI).href; // Resolve relative URLs
                    console.log('Found image via og:image:', imageUrl);
                }
            } catch (e) { console.warn('Error checking og:image:', e); }

            // 2. If no og:image, find largest visible image (fallback)
            if (!imageUrl) {
                console.log('og:image not found or invalid, searching images...');
                let largestImage = null;
                let maxArea = 0;
                const minDimension = 100; // Minimum width/height

                document.querySelectorAll('img').forEach(img => {
                    if (!img.src) return; // Skip if no src
                    
                    const width = img.naturalWidth || img.width;
                    const height = img.naturalHeight || img.height;
                    const isVisible = img.offsetParent !== null; // Basic visibility check
                    
                    if (isVisible && width >= minDimension && height >= minDimension) {
                        const area = width * height;
                        if (area > maxArea) {
                            maxArea = area;
                            largestImage = img;
                        }
                    }
                });

                if (largestImage) {
                    imageUrl = new URL(largestImage.src, document.baseURI).href; // Resolve relative URLs
                    console.log('Found largest image:', imageUrl, 'Size:', largestImage.naturalWidth, 'x', largestImage.naturalHeight);
                } else {
                    console.log('No suitable large image found on page.');
                }
            }
            // --- End Find Image URL --- 

            console.log('Extracted Context:', { paragraphText, imageUrl });

            return {
              paragraphText: paragraphText,
              paragraphHtml: paragraphHtml, 
              imageUrl: imageUrl 
            };
          }
        });
        
        if (result?.result) {
          context.paragraphText = result.result.paragraphText;
          context.paragraphHtml = result.result.paragraphHtml;
          context.imageUrl = result.result.imageUrl; // Store image URL in context
        }
      } catch (error) {
        console.log("Couldn't get detailed context:", error);
      }

      // Create memory using storage service
      const newMemory = await MemoryStorage.createMemory({
        front: info.selectionText.trim(),
        back: (context.paragraphText || info.selectionText).trim(), 
        context: context, // Context now includes imageUrl
        tags: []
        // Pass imageUrl explicitly if needed by createMemory, but embedding in context is simpler here
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