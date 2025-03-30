document.addEventListener('DOMContentLoaded', async () => {
    const frontTextarea = document.getElementById('front');
    const backTextarea = document.getElementById('back');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const originalUrl = document.getElementById('originalUrl');
    const savedDate = document.getElementById('savedDate');
    const tagsContainer = document.getElementById('tagsContainer');
    const newTagInput = document.getElementById('newTagInput');
    const addTagBtn = document.getElementById('addTagBtn');
    
    // Get memory ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');
    
    if (!memoryId) {
      alert('Invalid memory ID');
      window.close();
      return;
    }
    
    // Load the memory
    const { memories = [] } = await chrome.storage.local.get('memories');
    let memory = memories.find(m => m.id === memoryId);
    
    if (!memory) {
      alert('Memory not found');
      window.close();
      return;
    }
  
    // Initialize memory tags if not exists
    memory.tags = memory.tags || [];
    
    // Populate form
    frontTextarea.value = memory.front;
    backTextarea.value = memory.back;
    
    // Show context info
    originalUrl.textContent = memory.context?.url || '';
    originalUrl.href = memory.context?.url || '#';
    savedDate.textContent = new Date(memory.createdAt).toLocaleString();
  
    // Render tags
    function renderTags() {
      tagsContainer.innerHTML = '';
      memory.tags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag';
        tagEl.innerHTML = `
          ${tag}
          <span class="tag-remove" data-tag="${tag}">×</span>
        `;
        tagsContainer.appendChild(tagEl);
        
        tagEl.querySelector('.tag-remove').addEventListener('click', async (e) => {
          e.stopPropagation();
          memory.tags = memory.tags.filter(t => t !== tag);
          renderTags();
        });
      });
    }
    
    renderTags();
    
    // Add tag button
    addTagBtn.addEventListener('click', async () => {
      const tag = newTagInput.value.trim();
      if (tag && !memory.tags.includes(tag)) {
        memory.tags.push(tag);
        renderTags();
        newTagInput.value = '';
        
        // Update master tags list
        const { tags = [] } = await chrome.storage.local.get('tags');
        if (!tags.includes(tag)) {
          await chrome.storage.local.set({ 
            tags: [...tags, tag].sort() 
          });
        }
      }
    });
  
    // Enter key to add tag
    newTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTagBtn.click();
      }
    });
  
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      window.close();
    });
    
    // Save button
    saveBtn.addEventListener('click', async () => {
      const updatedMemories = memories.map(m => {
        if (m.id === memoryId) {
          return {
            ...m,
            front: frontTextarea.value.trim(),
            back: backTextarea.value.trim(),
            tags: memory.tags
          };
        }
        return m;
      });
      
      await chrome.storage.local.set({ memories: updatedMemories });
      window.close();
    });
    
    // Delete button
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to permanently delete this memory?')) {
        const updatedMemories = memories.filter(m => m.id !== memoryId);
        await chrome.storage.local.set({ memories: updatedMemories });
        window.close();
      }
    });
  });