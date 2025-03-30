document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const reviewBtn = document.getElementById('reviewBtn');
  const statsBtn = document.getElementById('statsBtn');
  const memoryList = document.getElementById('memoryList');
  const totalCount = document.getElementById('totalCount');
  const dueCount = document.getElementById('dueCount');
  const streakCount = document.getElementById('streakCount');
  const searchInput = document.getElementById('searchInput');
  const tagFilter = document.getElementById('tagFilter');
  const modeButtons = document.querySelectorAll('.mode-btn');

  // State
  let currentMode = 'spaced';
  let memories = [];
  let tags = [];
  let stats = {};

  // Initialize
  await loadData();
  renderMemoryList();
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