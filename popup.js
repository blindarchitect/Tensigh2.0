document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const reviewBtn = document.getElementById('reviewBtn');
  const statsBtn = document.getElementById('statsBtn');
  const memoryList = document.getElementById('memoryList');
  const totalCount = document.getElementById('totalCount');
  const dueCount = document.getElementById('dueCount');
  const streakCount = document.getElementById('streakCount');
  const searchInput = document.getElementById('searchInput');
  const tabSearchInput = document.getElementById('tabSearchInput');
  const tagFilter = document.getElementById('tagFilter');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const selectedTabsContainer = document.getElementById('selectedTabs');
  const noTabsMessage = document.getElementById('noTabsMessage');

  // State
  let currentMode = 'spaced';
  let currentTab = 'study';
  let memories = [];
  let tags = [];
  let stats = {};
  let savedTabs = [];

  // Initialize
  await loadData();
  renderMemoryList();
  setupEventListeners();
  updatePopupUI();

  // Data loading
  async function loadData() {
    const data = await chrome.storage.local.get(['memories', 'tags', 'stats']);
    memories = data.memories || [];
    tags = data.tags || [];
    stats = data.stats || { created: 0, reviewed: 0, streak: 0 };
    
    // Extract saved tabs for quick access
    savedTabs = memories.filter(m => 
      m.context?.type === 'savedTab' || 
      m.context?.type === 'tabGroup' ||
      m.tags?.includes('saved-tab') ||
      m.tags?.includes('tab-group')
    );
    
    updateCounters();
    populateTagFilter();
  }

  function updateCounters() {
    totalCount.textContent = memories.length;
    dueCount.textContent = memories.filter(m => new Date(m.nextReview) <= new Date()).length;
    streakCount.textContent = stats.streak || 0;
  }

  function populateTagFilter() {
    tagFilter.innerHTML = '<option value="">All Tags</option>';
    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  // Tab handling
  function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
    
    // Render appropriate content
    if (tabName === 'saved-tabs') {
      renderMemoryList('', true);
    } else {
      renderMemoryList(searchInput.value);
    }
  }

  // Rendering
  function renderMemoryList(filter = '', savedTabsOnly = false) {
    memoryList.innerHTML = '';
    
    // Determine which memories to show
    let filteredMemories = memories;
    
    // Filter for saved tabs if in saved tabs mode
    if (savedTabsOnly || currentTab === 'saved-tabs') {
      filteredMemories = savedTabs;
      // Apply search to saved tabs if there's a search term
      if (tabSearchInput.value) {
        const term = tabSearchInput.value.toLowerCase();
        filteredMemories = filteredMemories.filter(m => 
          m.front.toLowerCase().includes(term) || 
          m.back.toLowerCase().includes(term) ||
          (m.context?.url && m.context.url.toLowerCase().includes(term)) ||
          (m.context?.tabGroup && JSON.stringify(m.context.tabGroup).toLowerCase().includes(term))
        );
      }
    } else {
      // Regular memories filtering
      if (filter) {
        const term = filter.toLowerCase();
        filteredMemories = memories.filter(m => 
          m.front.toLowerCase().includes(term) || 
          m.back.toLowerCase().includes(term) ||
          (m.tags && m.tags.some(t => t.toLowerCase().includes(term)))
        );
      }
      
      const selectedTag = tagFilter.value;
      if (selectedTag) {
        filteredMemories = filteredMemories.filter(m => 
          m.tags && m.tags.includes(selectedTag)
        );
      }
    }
    
    // Show message if no items found
    if (filteredMemories.length === 0) {
      const noItemsMsg = document.createElement('div');
      noItemsMsg.className = 'no-items-message';
      noItemsMsg.textContent = currentTab === 'saved-tabs' 
        ? 'No saved tabs found. Use Ctrl+click on tabs to add them to a group.' 
        : 'No memories found.';
      memoryList.appendChild(noItemsMsg);
      return;
    }
    
    // Render the filtered memories
    filteredMemories.slice(0, 50).forEach(memory => {
      const memoryEl = document.createElement('div');
      const isSavedTab = memory.context?.type === 'savedTab' || memory.tags?.includes('saved-tab');
      const isTabGroup = memory.context?.type === 'tabGroup' || memory.tags?.includes('tab-group');
      
      memoryEl.className = 'memory-item';
      if (isSavedTab) {
        memoryEl.classList.add('saved-tab');
      }
      if (isTabGroup) {
        memoryEl.classList.add('tab-group');
      }
      
      memoryEl.dataset.id = memory.id;
      
      // Format the URL nicely if it's a saved tab
      let formattedUrl = '';
      if (memory.context?.url) {
        try {
          const url = new URL(memory.context.url);
          formattedUrl = `${url.hostname}${url.pathname}`;
          if (formattedUrl.length > 40) {
            formattedUrl = formattedUrl.substring(0, 40) + '...';
          }
        } catch (e) {
          formattedUrl = memory.context.url;
        }
      }
      
      // Create memory item content based on its type
      if (isTabGroup && memory.context?.tabGroup) {
        const group = memory.context.tabGroup;
        const tabsCount = group.tabs.length;
        
        // Create tab group display
        memoryEl.innerHTML = `
          <div class="memory-text">${memory.front}</div>
          <div class="tab-group-preview">
            ${group.tabs.slice(0, 3).map(tab => {
              const domain = getDomain(tab.url);
              return `<div class="tab-preview" title="${tab.title}">
                ${tab.favicon ? `<img src="${tab.favicon}" class="tab-favicon" alt="">` : ''}
                <span>${domain}</span>
              </div>`;
            }).join('')}
            ${tabsCount > 3 ? `<div class="tab-preview more-tabs">+${tabsCount - 3} more</div>` : ''}
          </div>
          <div class="memory-meta">
            <span>${formatDate(memory.createdAt)}</span>
            <span>${tabsCount} tabs</span>
          </div>
          <div class="memory-actions">
            <button class="restore-all-btn" title="Restore All Tabs">🔄</button>
            <button class="tag-btn">🏷</button>
            <button class="delete-btn">🗑</button>
            <button class="edit-btn">✏</button>
          </div>
          ${memory.tags?.length ? `
            <div class="memory-tags">
              ${memory.tags.map(tag => {
                const isTabTag = tag === 'saved-tab' || tag === 'tab-group';
                return `<span class="tag ${isTabTag ? 'savedtab-tag' : ''}">${tag}</span>`;
              }).join('')}
            </div>
          ` : ''}
        `;
        
        // Add event listeners for tab group
        memoryEl.querySelector('.tag-btn').addEventListener('click', () => addTagToMemory(memory.id));
        memoryEl.querySelector('.delete-btn').addEventListener('click', () => deleteMemory(memory.id));
        memoryEl.querySelector('.edit-btn').addEventListener('click', () => editMemory(memory.id));
        memoryEl.querySelector('.restore-all-btn').addEventListener('click', () => restoreTabGroup(memory));
        
        // Add click handler to expand the group
        memoryEl.querySelector('.memory-text').addEventListener('click', () => {
          memoryEl.classList.toggle('expanded');
          if (memoryEl.classList.contains('expanded')) {
            expandTabGroup(memoryEl, group);
          } else {
            collapseTabGroup(memoryEl, group);
          }
        });
        
      } else {
        // Regular memory or single saved tab
        memoryEl.innerHTML = `
          <div class="memory-text">${memory.front}</div>
          <div class="memory-meta">
            <span>${formatDate(memory.createdAt)}</span>
            <span title="${memory.context?.url || ''}">${isSavedTab ? formattedUrl : getDomain(memory.context?.url || '')}</span>
          </div>
          ${isSavedTab ? `<div class="saved-tab-url">${memory.context?.url}</div>` : ''}
          <div class="memory-actions">
            ${isSavedTab ? `<button class="restore-btn" title="Restore Tab">🔄</button>` : ''}
            <button class="tag-btn">🏷</button>
            <button class="delete-btn">🗑</button>
            <button class="edit-btn">✏</button>
          </div>
          ${memory.tags?.length ? `
            <div class="memory-tags">
              ${memory.tags.map(tag => {
                const isTabTag = tag === 'saved-tab' || tag === 'tab-group';
                return `<span class="tag ${isTabTag ? 'savedtab-tag' : ''}">${tag}</span>`;
              }).join('')}
            </div>
          ` : ''}
        `;
        
        // Add event listeners
        memoryEl.querySelector('.tag-btn').addEventListener('click', () => addTagToMemory(memory.id));
        memoryEl.querySelector('.delete-btn').addEventListener('click', () => deleteMemory(memory.id));
        memoryEl.querySelector('.edit-btn').addEventListener('click', () => editMemory(memory.id));
        
        // Add restore button listener for saved tabs
        if (isSavedTab) {
          memoryEl.querySelector('.restore-btn').addEventListener('click', () => restoreSavedTab(memory));
        }
      }
      
      memoryList.appendChild(memoryEl);
    });
  }
  
  // Expand tab group to show all tabs
  function expandTabGroup(el, group) {
    // Create tab list if not already expanded
    if (!el.querySelector('.tab-list')) {
      const tabListEl = document.createElement('div');
      tabListEl.className = 'tab-list';
      
      group.tabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab-item';
        tabEl.innerHTML = `
          <div class="tab-item-content">
            ${tab.favicon ? `<img src="${tab.favicon}" class="tab-favicon" alt="">` : ''}
            <div class="tab-title" title="${tab.title}">${tab.title}</div>
            <div class="tab-url" title="${tab.url}">${tab.url}</div>
          </div>
          <div class="tab-item-actions">
            <button class="restore-single-btn" data-index="${index}" title="Restore this tab">🔄</button>
          </div>
        `;
        tabListEl.appendChild(tabEl);
      });
      
      // Insert after the preview
      const previewEl = el.querySelector('.tab-group-preview');
      previewEl.insertAdjacentElement('afterend', tabListEl);
      
      // Add event listeners for individual tab restore buttons
      tabListEl.querySelectorAll('.restore-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          restoreSingleTab(group.tabs[index]);
        });
      });
    }
  }
  
  // Collapse tab group
  function collapseTabGroup(el, group) {
    const tabList = el.querySelector('.tab-list');
    if (tabList) {
      tabList.remove();
    }
  }

  // Event handlers
  function setupEventListeners() {
    // Tab navigation
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });
    
    // Mode selection
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
      });
    });

    // Search in study mode
    searchInput.addEventListener('input', (e) => {
      renderMemoryList(e.target.value);
    });

    // Search in saved tabs mode
    tabSearchInput.addEventListener('input', (e) => {
      renderMemoryList('', true);
    });

    // Tag filter
    tagFilter.addEventListener('change', () => {
      renderMemoryList(searchInput.value);
    });

    // Review button
    reviewBtn.addEventListener('click', () => {
      const dueMemories = memories.filter(m => new Date(m.nextReview) <= new Date());
      if (dueMemories.length === 0) {
        alert('No memories due for review!');
        return;
      }
      
      let reviewUrl = 'review.html';
      if (currentMode === 'quiz') reviewUrl = 'quiz.html';
      
      chrome.tabs.create({ 
        url: chrome.runtime.getURL(reviewUrl),
        active: true
      });
    });

    // Stats button
    statsBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('stats.html'),
        active: true
      });
    });

    // Import/Export handlers
    document.getElementById('importBtn').addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          await MemoryStorage.importData(text);
          await loadData();
          renderMemoryList();
          alert('Memories imported successfully!');
        } catch (error) {
          alert('Error importing memories: ' + error.message);
        }
      };
      
      input.click();
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
      try {
        const data = await MemoryStorage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tensigh-memories-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        alert('Error exporting memories: ' + error.message);
      }
    });
  }

  // Memory actions
  async function addTagToMemory(memoryId) {
    const tag = prompt('Enter a tag for this memory:');
    if (!tag) return;
    
    const updatedMemories = memories.map(m => {
      if (m.id === memoryId) {
        const newTags = [...(m.tags || []), tag.trim()];
        return { ...m, tags: [...new Set(newTags)] };
      }
      return m;
    });
    
    await chrome.storage.local.set({ 
      memories: updatedMemories,
      tags: [...new Set([...tags, tag.trim()])]
    });
    
    await loadData();
    renderMemoryList(searchInput.value, currentTab === 'saved-tabs');
  }

  async function deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    const updatedMemories = memories.filter(m => m.id !== memoryId);
    await chrome.storage.local.set({ 
      memories: updatedMemories,
      stats: { ...stats, created: stats.created - 1 }
    });
    
    await loadData();
    renderMemoryList(searchInput.value, currentTab === 'saved-tabs');
  }

  function editMemory(memoryId) {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL(`edit.html?id=${memoryId}`),
      active: true
    });
  }

  // Restore saved tab
  async function restoreSavedTab(memory) {
    if (!memory.context || !memory.context.url) {
      alert('Cannot restore tab: Missing URL information');
      return;
    }
    
    try {
      // Create a new tab with the saved URL
      const tab = await chrome.tabs.create({ 
        url: memory.context.url,
        active: true
      });
      
      // Set the tab as loading using a more reliable approach
      try {
        await chrome.runtime.sendMessage({
          action: 'setTabLoading',
          tabId: tab.id
        });
      } catch (badgeError) {
        console.log('Error setting tab loading state:', badgeError);
        // Continue anyway - badge indication is non-critical
      }
      
      // If we have scroll position information, set it after the page loads
      if (memory.context.scrollPosition) {
        // Wait for the tab to complete loading
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          // Make sure we're dealing with the right tab
          if (tabId === tab.id && changeInfo.status === 'complete') {
            try {
              // Execute script to set scroll position
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (scrollX, scrollY) => {
                  window.scrollTo(scrollX, scrollY);
                },
                args: [memory.context.scrollPosition.x, memory.context.scrollPosition.y]
              }).then(() => {
                // Mark the tab as loaded (but handle failure gracefully)
                try {
                  chrome.runtime.sendMessage({
                    action: 'setTabLoaded',
                    tabId: tab.id
                  });
                } catch (err) {
                  console.log('Error marking tab as loaded:', err);
                }
              }).catch(error => {
                console.log('Error setting scroll position:', error);
              });
            } catch (error) {
              console.log('Error executing scroll script:', error);
            }
            
            // Remove the listener once we've tried to set the scroll position
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      } else {
        // For tabs without scroll position, still mark as loaded when complete
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            try {
              chrome.runtime.sendMessage({
                action: 'setTabLoaded',
                tabId: tab.id
              });
            } catch (err) {
              console.log('Error marking tab as loaded:', err);
            }
            
            // Remove the listener
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    } catch (error) {
      console.error('Error restoring tab:', error);
      alert('Error restoring tab: ' + error.message);
    }
  }
  
  // Restore a single tab from a group
  async function restoreSingleTab(tabInfo) {
    if (!tabInfo || !tabInfo.url) {
      alert('Cannot restore tab: Missing URL information');
      return;
    }
    
    try {
      // Create a new tab with the saved URL
      const tab = await chrome.tabs.create({ 
        url: tabInfo.url,
        active: true
      });
      
      // Set the tab as loading
      try {
        await chrome.runtime.sendMessage({
          action: 'setTabLoading',
          tabId: tab.id
        });
      } catch (badgeError) {
        console.log('Error setting tab loading state:', badgeError);
        // Continue anyway - badge indication is non-critical
      }
      
      // If we have scroll position information, set it after the page loads
      if (tabInfo.scrollPosition) {
        // Wait for the tab to complete loading
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            try {
              // Execute script to set scroll position
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (scrollX, scrollY) => {
                  window.scrollTo(scrollX, scrollY);
                },
                args: [tabInfo.scrollPosition.x, tabInfo.scrollPosition.y]
              }).then(() => {
                // Mark the tab as loaded
                try {
                  chrome.runtime.sendMessage({
                    action: 'setTabLoaded',
                    tabId: tab.id
                  });
                } catch (err) {
                  console.log('Error marking tab as loaded:', err);
                }
              }).catch(error => {
                console.log('Error setting scroll position:', error);
              });
            } catch (error) {
              console.log('Error executing scroll script:', error);
            }
            
            // Remove the listener once we've tried to set the scroll position
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      } else {
        // For tabs without scroll position, still mark as loaded when complete
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            try {
              chrome.runtime.sendMessage({
                action: 'setTabLoaded',
                tabId: tab.id
              });
            } catch (err) {
              console.log('Error marking tab as loaded:', err);
            }
            
            // Remove the listener
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    } catch (error) {
      console.error('Error restoring tab:', error);
      alert('Error restoring tab: ' + error.message);
    }
  }
  
  // Restore entire tab group
  async function restoreTabGroup(memory) {
    if (!memory.context?.tabGroup || !memory.context.tabGroup.tabs || memory.context.tabGroup.tabs.length === 0) {
      alert('Cannot restore tab group: Invalid tab group data');
      return;
    }
    
    try {
      const group = memory.context.tabGroup;
      const tabs = group.tabs;
      
      // Create a new window with the first tab
      const window = await chrome.windows.create({
        url: tabs[0].url,
        focused: true
      });
      
      // Get the first tab ID
      const firstTabId = window.tabs[0].id;
      
      // Set scroll position for first tab if needed
      if (tabs[0].scrollPosition) {
        setTabScrollPosition(firstTabId, tabs[0].scrollPosition);
      }
      
      // Create the rest of the tabs in the new window
      for (let i = 1; i < tabs.length; i++) {
        const tab = tabs[i];
        const newTab = await chrome.tabs.create({
          windowId: window.id,
          url: tab.url,
          active: false
        });
        
        if (tab.scrollPosition) {
          setTabScrollPosition(newTab.id, tab.scrollPosition);
        }
      }
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png', 
        title: 'Tab Group Restored',
        message: `Restored ${tabs.length} tabs from "${group.groupName}"`
      });
      
    } catch (error) {
      console.error('Error restoring tab group:', error);
      alert('Error restoring tab group: ' + error.message);
    }
  }
  
  // Helper function to set scroll position for a tab
  function setTabScrollPosition(tabId, scrollPosition) {
    // Set the tab as loading with better error handling
    try {
      chrome.runtime.sendMessage({
        action: 'setTabLoading',
        tabId: tabId
      });
    } catch (badgeError) {
      console.log('Error setting tab loading state:', badgeError);
      // Continue anyway
    }
    
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        try {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (scrollX, scrollY) => {
              window.scrollTo(scrollX, scrollY);
            },
            args: [scrollPosition.x, scrollPosition.y]
          }).then(() => {
            // Mark the tab as loaded
            try {
              chrome.runtime.sendMessage({
                action: 'setTabLoaded',
                tabId: tabId
              });
            } catch (err) {
              console.log('Error marking tab as loaded:', err);
            }
          }).catch(error => {
            console.log('Error setting scroll position:', error);
          });
        } catch (error) {
          console.log('Error executing scroll script:', error);
        }
        
        // Remove the listener once we've attempted to set the scroll position
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  }

  // Helpers
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }

  function getDomain(url) {
    if (!url) return '';
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return '';
    }
  }

  // Function to update the popup UI
  function updatePopupUI() {
    chrome.runtime.sendMessage({ action: "getSelectedTabs" }, function(response) {
      if (response && response.selectedTabs && response.selectedTabs.length > 0) {
        selectedTabsContainer.style.display = 'block';
        noTabsMessage.style.display = 'none';
        
        selectedTabsContainer.innerHTML = '';
        
        // Add the selected tabs
        response.selectedTabs.forEach(tab => {
          const tabElement = document.createElement('div');
          tabElement.className = 'selected-tab';
          
          const favicon = document.createElement('img');
          favicon.className = 'favicon';
          favicon.src = tab.favIconUrl || 'default-favicon.png';
          
          const title = document.createElement('div');
          title.className = 'tab-title';
          title.textContent = tab.title;
          
          tabElement.appendChild(favicon);
          tabElement.appendChild(title);
          selectedTabsContainer.appendChild(tabElement);
        });
      } else {
        selectedTabsContainer.style.display = 'none';
        noTabsMessage.style.display = 'block';
        noTabsMessage.textContent = 'No tabs in group. Hold Ctrl and click on tabs to add them to a group.';
      }
    });
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "tabsSaved") {
      updatePopupUI();
    }
  });

  // Update UI when popup opens
  document.addEventListener('DOMContentLoaded', updatePopupUI);
});