document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const reviewBtn = document.getElementById('reviewBtn');
  const statsBtn = document.getElementById('statsBtn');
  const saveTabBtn = document.getElementById('saveTabBtn');
  const memoryList = document.getElementById('memoryList');
  const totalCount = document.getElementById('totalCount');
  const dueCount = document.getElementById('dueCount');
  const streakCount = document.getElementById('streakCount');
  const searchInput = document.getElementById('searchInput');
  const tagFilter = document.getElementById('tagFilter');
  const modeButtons = document.querySelectorAll('.mode-btn');
  // Added Elements
  const tabGroupListContainer = document.getElementById('tabGroupList');
  const newGroupNameInput = document.getElementById('newGroupNameInput');
  const groupSelectedTabsBtn = document.getElementById('groupSelectedTabsBtn');
  const viewSavedGroupsBtn = document.getElementById('viewSavedGroupsBtn');

  // State
  let currentMode = 'spaced';
  let memories = [];
  let tags = [];
  let stats = {};

  // Initialize
  await loadData();
  renderMemoryList();
  renderTabGroupList();
  setupEventListeners();

  // Data loading
  async function loadData() {
    const data = await chrome.storage.local.get(['memories', 'tags', 'stats']);
    memories = data.memories || [];
    tags = data.tags || [];
    stats = data.stats || { created: 0, reviewed: 0, streak: 0 };
    
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

  // Rendering
  function renderMemoryList(filter = '') {
    memoryList.innerHTML = '';
    
    let filteredMemories = memories;
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
    
    filteredMemories.slice(0, 20).forEach(memory => {
      const memoryEl = document.createElement('div');
      memoryEl.className = 'memory-item';
      memoryEl.dataset.id = memory.id;
      memoryEl.innerHTML = `
        <div class="memory-text">${memory.front}</div>
        <div class="memory-meta">
          <span>${formatDate(memory.createdAt)}</span>
          <span>${getDomain(memory.context.url)}</span>
        </div>
        <div class="memory-actions">
          <button class="tag-btn">🏷</button>
          <button class="delete-btn">🗑</button>
          <button class="edit-btn">✏</button>
        </div>
        ${memory.tags?.length ? `
          <div class="memory-tags">
            ${memory.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
      `;
      memoryList.appendChild(memoryEl);
      
      // Add event listeners
      memoryEl.querySelector('.tag-btn').addEventListener('click', () => addTagToMemory(memory.id));
      memoryEl.querySelector('.delete-btn').addEventListener('click', () => deleteMemory(memory.id));
      memoryEl.querySelector('.edit-btn').addEventListener('click', () => editMemory(memory.id));
    });
  }

  // Added: Rendering Tab Group List
  async function renderTabGroupList() {
    if (!chrome.tabGroups) {
      console.warn("Tab Groups API not available.");
      tabGroupListContainer.innerHTML = '<p>Tab group features require Chrome 90+.</p>';
      return;
    }
    try {
      const groups = await chrome.tabGroups.query({});
      tabGroupListContainer.innerHTML = ''; // Clear previous list

      if (groups.length === 0) {
        tabGroupListContainer.innerHTML = '<p class="no-groups-msg">No active tab groups found.</p>';
        return;
      }

      groups.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'tab-group-item';
        groupEl.innerHTML = `
          <span class="tab-group-color" style="background-color: ${group.color}"></span>
          <span class="tab-group-title">${group.title || 'Untitled Group'}</span>
          <button class="save-group-btn secondary-btn" data-group-id="${group.id}">Save</button>
        `;
        
        const saveBtn = groupEl.querySelector('.save-group-btn');
        saveBtn.addEventListener('click', handleSaveExistingGroup);
        
        tabGroupListContainer.appendChild(groupEl);
      });
    } catch (error) {
      console.error("Error rendering tab group list:", error);
      tabGroupListContainer.innerHTML = '<p class="error-msg">Error loading tab groups.</p>';
    }
  }

  // Event handlers
  function setupEventListeners() {
    // Mode selection
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
      });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      renderMemoryList(e.target.value);
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

    // Save Tab button
    saveTabBtn.addEventListener('click', async () => {
        try {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (currentTab) {
                await MemoryStorage.saveTab({
                    title: currentTab.title,
                    url: currentTab.url,
                    favIconUrl: currentTab.favIconUrl
                });
                
                // Visual feedback
                saveTabBtn.textContent = 'Tab Saved!';
                saveTabBtn.disabled = true;
                setTimeout(() => {
                    saveTabBtn.textContent = 'Save Current Tab';
                    saveTabBtn.disabled = false;
                }, 1500);
            } else {
                console.error("Could not get current tab information.");
                // Maybe provide feedback to user?
            }
        } catch (error) {
            console.error("Error saving tab:", error);
            // Maybe provide feedback to user?
        }
    });

    // Modified Listener for Group Selected Tabs Button
    groupSelectedTabsBtn.addEventListener('click', async () => {
        try {
            const highlightedTabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
            
            if (highlightedTabs.length === 0) {
                alert('Please select (highlight) one or more tabs first.');
                return;
            }

            const tabIds = highlightedTabs.map(tab => tab.id);
            
            // Create the native Chrome tab group
            const newGroupId = await chrome.tabs.group({ tabIds: tabIds });
            console.log(`Created new group with ID: ${newGroupId}`);

            // Optionally update the group's title
            let groupTitle = newGroupNameInput.value.trim();
            if (groupTitle) {
                await chrome.tabGroups.update(newGroupId, { title: groupTitle });
                console.log(`Updated group ${newGroupId} title to: ${groupTitle}`);
            }

            // --- Removed direct save to MemoryStorage ---            
            
            // Refresh the list of groups in the popup
            await renderTabGroupList(); 
            
            // Feedback
            groupSelectedTabsBtn.textContent = 'Group Created!';
            newGroupNameInput.value = ''; // Clear input
            setTimeout(() => {
                groupSelectedTabsBtn.textContent = 'Create Group';
            }, 1500);
            
        } catch (error) {
            console.error("Error creating group from selected tabs:", error);
            alert("An error occurred while creating the group."); // User feedback
        }    
    });
    
    // Ensure event listener for the dynamically created save buttons still exists
    // (handleSaveExistingGroup is attached within renderTabGroupList)

    // Added Listener for View Saved Groups Button
    viewSavedGroupsBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('saved_groups.html')
        });
    });

  }
  
  // Handler for Saving Existing Group
  async function handleSaveExistingGroup(event) {
    const saveBtn = event.target;
    const groupId = parseInt(saveBtn.dataset.groupId, 10);
    
    if (isNaN(groupId)) {
        console.error("Invalid groupId:", saveBtn.dataset.groupId);
        return;
    }
    
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    let tabsInGroup = []; // Keep track of tab IDs
    
    try {
        const groupInfo = await chrome.tabGroups.get(groupId);
        tabsInGroup = await chrome.tabs.query({ groupId: groupId });
        
        const tabsToSave = tabsInGroup.map(tab => ({
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl
        }));
            
        await MemoryStorage.saveTabGroup({
            originalGroupId: groupInfo.id.toString(),
            title: groupInfo.title || 'Untitled Group',
            color: groupInfo.color,
            tabs: tabsToSave
        });
        
        saveBtn.textContent = 'Saved!';
        
        // --- Auto-close the native group --- 
        try {
          const tabIdsToUngroup = tabsInGroup.map(tab => tab.id);
          if (tabIdsToUngroup.length > 0) {
              await chrome.tabs.ungroup(tabIdsToUngroup);
              console.log(`Ungrouped native group ${groupId}`);
              // Refresh the list in the popup to remove the group
              await renderTabGroupList(); 
          }
        } catch (ungroupError) {
            console.error(`Error ungrouping group ${groupId}:`, ungroupError);
            // Don't block the rest of the flow if ungrouping fails
        }
        // --- End Auto-close ---
        
        // Keep button disabled after successful save & close
        
    } catch (error) {
        console.error(`Error saving group ${groupId}:`, error);
        alert(`An error occurred while saving group: ${groupId}`);
        saveBtn.textContent = 'Save'; // Reset on error
        saveBtn.disabled = false;
    }
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
    renderMemoryList(searchInput.value);
  }

  async function deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    const updatedMemories = memories.filter(m => m.id !== memoryId);
    await chrome.storage.local.set({ 
      memories: updatedMemories,
      stats: { ...stats, created: stats.created - 1 }
    });
    
    await loadData();
    renderMemoryList(searchInput.value);
  }

  function editMemory(memoryId) {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL(`edit.html?id=${memoryId}`),
      active: true
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
});