// Added: Helper function to escape HTML characters
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"/]/g, function (s) {
      const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
      };
      return entityMap[s];
    });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for DOM to be fully loaded
  const questionEl = document.getElementById('question');
  const answerEl = document.getElementById('answer');
  const contextEl = document.getElementById('context');
  const showAnswerBtn = document.getElementById('showAnswerBtn');
  const ratingButtons = document.getElementById('ratingButtons');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const editCurrentCardBtn = document.getElementById('editCurrentCardBtn');
  const deleteCurrentCardBtn = document.getElementById('deleteCurrentCardBtn');

  // Check if all required elements exist
  if (!questionEl || !answerEl || !contextEl || !showAnswerBtn || !ratingButtons || !progressBar || !progressText || !editCurrentCardBtn || !deleteCurrentCardBtn) {
    console.error('Required elements not found in DOM');
    return;
  }

  let memories = [];
  let currentIndex = 0;
  let currentMemoryId = null;
  
  // Load due memories
  try {
    const { memories: allMemories = [] } = await chrome.storage.local.get('memories');
    memories = allMemories.filter(m => new Date(m.nextReview) <= new Date());
    
    if (memories.length === 0) {
      questionEl.textContent = "No memories to review right now!";
      showAnswerBtn.style.display = 'none';
      return;
    }
    
    // Shuffle memories
    memories = shuffleArray(memories);
    setupActionListeners();
    updateProgress();
    showMemory();
  } catch (error) {
    console.error("Error loading memories:", error);
    questionEl.textContent = "Error loading memories. Please try again.";
    return;
  }

  // Show current memory
  function showMemory() {
    if (currentIndex >= memories.length) {
      showCompletionScreen();
      return;
    }
    
    const memory = memories[currentIndex];
    currentMemoryId = memory.id;
    
    console.log(`Displaying memory (Index: ${currentIndex}, ID: ${currentMemoryId}):`, JSON.stringify(memory, null, 2));
    
    // --- Display Front Content (Question + Image) ---
    // Use escapeHTML on the memory.front text
    let frontHtml = `<div class="memory-text-content">${escapeHTML(memory.front)}</div>`; 
    if (memory.context?.imageUrl) {
        frontHtml += `<img src="${memory.context.imageUrl}" class="memory-image" alt="Memory image">`;
    }
    questionEl.innerHTML = frontHtml; 
    // --- End Display Front Content ---
    
    // Display Back Content (Escape it too, just in case it's ever rendered with innerHTML)
    answerEl.textContent = memory.back; // Using textContent is safer for back if no HTML is needed
    // If back *might* need HTML rendering later, use: answerEl.innerHTML = escapeHTML(memory.back);
    
    contextEl.innerHTML = memory.context?.url ? 
      `Source: <a href="${memory.context.url}" target="_blank">${new URL(memory.context.url).hostname}</a>` : '';
    
    // Hide answer initially
    answerEl.style.display = 'none';
    contextEl.style.display = 'none';
    ratingButtons.style.display = 'none';
    showAnswerBtn.style.display = 'block';
    
    // Show/Hide action buttons appropriately
    editCurrentCardBtn.style.display = 'block';
    deleteCurrentCardBtn.style.display = 'block';
  }

  // Update progress display
  function updateProgress() {
    const progress = ((currentIndex) / memories.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.min(currentIndex + 1, memories.length)}/${memories.length}`;
  }

  // Show answer button
  showAnswerBtn.addEventListener('click', () => {
    answerEl.style.display = 'block';
    contextEl.style.display = 'block';
    ratingButtons.style.display = 'grid';
    showAnswerBtn.style.display = 'none';
  });

  // Rating buttons
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rating = parseInt(btn.dataset.rating);
      await rateMemory(rating);
    });
  });

  // Rate memory and schedule next review
  async function rateMemory(rating) {
    const memory = memories[currentIndex];
    
    // Update memory based on rating
    memory.reviewCount = (memory.reviewCount || 0) + 1;
    memory.lastRating = rating; // Store the last rating
    
    if (rating === 1) { // Again
      memory.interval = 1;
      memory.easeFactor = Math.max(1.3, memory.easeFactor - 0.2);
    } else {
      if (memory.reviewCount === 1) {
        memory.interval = 1;
      } else if (memory.reviewCount === 2) {
        memory.interval = 3;
      } else {
        memory.interval = Math.round(memory.interval * memory.easeFactor);
      }
      
      // Adjust ease factor based on rating
      if (rating === 2) { // Hard
        memory.easeFactor = Math.max(1.3, memory.easeFactor - 0.15);
      } else if (rating === 4) { // Easy
        memory.easeFactor = Math.min(2.5, memory.easeFactor + 0.15);
      }
    }
    
    // Set next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + memory.interval);
    memory.nextReview = nextReview.toISOString();
    
    // Save updated memory
    try {
      const { memories: allMemories } = await chrome.storage.local.get('memories');
      const updatedMemories = allMemories.map(m => 
        m.id === memory.id ? memory : m
      );
      await chrome.storage.local.set({ memories: updatedMemories });
      
      // Update stats
      const { stats = {} } = await chrome.storage.local.get('stats');
      await chrome.storage.local.set({
        stats: {
          ...stats,
          reviewed: (stats.reviewed || 0) + 1,
          streak: (stats.streak || 0) + 1,
          lastReviewDate: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error saving memory:", error);
    }
    
    // Move to next memory or finish
    currentIndex++;
    showNextCardOrFinish();
  }

  // Added: Central function to show next card or finish
  function showNextCardOrFinish() {
    if (currentIndex < memories.length) {
      updateProgress();
      showMemory();
    } else {
      updateProgress(); // Update progress to show full bar
      showCompletionScreen();
    }
  }
  
  // Added: Setup listeners for Edit/Delete
  function setupActionListeners() {
    editCurrentCardBtn.addEventListener('click', handleEditCard);
    deleteCurrentCardBtn.addEventListener('click', handleDeleteCard);
  }
  
  // Added: Handle Edit Button Click
  function handleEditCard() {
    if (!currentMemoryId) return;
    
    console.log(`Opening edit page for card ID: ${currentMemoryId}`);
    // Open edit page in new tab
    chrome.tabs.create({ 
      url: chrome.runtime.getURL(`edit.html?id=${currentMemoryId}`),
      active: true
    });
    
    // Immediately move to the next card in the review session
    // The user can review the edited card later
    currentIndex++; // Move index forward
    showNextCardOrFinish();
  }
  
  // Added: Handle Delete Button Click
  async function handleDeleteCard() {
    if (!currentMemoryId) return;
    
    const memoryToDelete = memories[currentIndex]; // Get ref before potentially modifying index
    
    if (confirm(`Are you sure you want to delete this card?\n\nFront: ${memoryToDelete.front}`)) {
      try {
        console.log(`Deleting card ID: ${currentMemoryId}`);
        await MemoryStorage.deleteMemory(currentMemoryId);
        
        // Remove card from the current session array
        memories.splice(currentIndex, 1);
        
        console.log(`Card removed. Remaining in session: ${memories.length}`);
        
        // Important: Don't increment currentIndex here, as splice shifted the array.
        // Show the card now at the *same* currentIndex (which is the next card),
        // or finish if the array is now empty or we were at the end.
        currentMemoryId = null; // Clear ID before potentially finishing
        showNextCardOrFinish(); 
        
      } catch (error) {
        console.error("Error deleting memory:", error);
        alert("Failed to delete the card.");
      }
    } else {
      console.log("Deletion cancelled by user.");
    }
  }

  // Added: Consolidated Completion Screen Logic
  function showCompletionScreen() {
    console.log("Review session complete.");
    currentMemoryId = null; // Clear current ID
    questionEl.textContent = "Review complete!";
    answerEl.style.display = 'none';
    contextEl.style.display = 'none';
    ratingButtons.style.display = 'none';
    editCurrentCardBtn.style.display = 'none'; // Hide action buttons
    deleteCurrentCardBtn.style.display = 'none';
    showAnswerBtn.style.display = 'none';
    
    // Avoid adding completion buttons multiple times
    if (!document.getElementById('viewStatsBtn')) {
      const completionButtons = document.createElement('div');
      completionButtons.className = 'completion-buttons';
      completionButtons.innerHTML = `
        <button id="viewStatsBtn" class="primary-btn">View Stats</button>
        <button id="closeBtn" class="secondary-btn">Close Window</button>
      `;
      
      document.querySelector('.controls').appendChild(completionButtons);
      
      document.getElementById('viewStatsBtn').addEventListener('click', () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL('stats.html'),
          active: true
        });
      });
      
      document.getElementById('closeBtn').addEventListener('click', () => {
        window.close();
      });
    }
  }

  // Helper function to shuffle array
  function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
});