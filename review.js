document.addEventListener('DOMContentLoaded', async () => {
  // Wait for DOM to be fully loaded
  const questionEl = document.getElementById('question');
  const answerEl = document.getElementById('answer');
  const contextEl = document.getElementById('context');
  const showAnswerBtn = document.getElementById('showAnswerBtn');
  const ratingButtons = document.getElementById('ratingButtons');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  // Check if all required elements exist
  if (!questionEl || !answerEl || !contextEl || !showAnswerBtn || !ratingButtons || !progressBar || !progressText) {
    console.error('Required elements not found in DOM');
    return;
  }

  let memories = [];
  let currentIndex = 0;
  
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
    updateProgress();
    showMemory();
  } catch (error) {
    console.error("Error loading memories:", error);
    questionEl.textContent = "Error loading memories. Please try again.";
    return;
  }

  // Show current memory
  function showMemory() {
    const memory = memories[currentIndex];
    questionEl.textContent = memory.front;
    answerEl.textContent = memory.back;
    contextEl.innerHTML = memory.context?.url ? 
      `Source: <a href="${memory.context.url}" target="_blank">${new URL(memory.context.url).hostname}</a>` : '';
    
    // Hide answer initially
    answerEl.style.display = 'none';
    contextEl.style.display = 'none';
    ratingButtons.style.display = 'none';
    showAnswerBtn.style.display = 'block';
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
    updateProgress();
    
    if (currentIndex < memories.length) {
      showMemory();
    } else {
      // Create completion screen
      questionEl.textContent = "Review complete!";
      answerEl.style.display = 'none';
      contextEl.style.display = 'none';
      ratingButtons.style.display = 'none';
      
      // Create completion buttons container
      const completionButtons = document.createElement('div');
      completionButtons.className = 'completion-buttons';
      completionButtons.innerHTML = `
        <button id="viewStatsBtn" class="primary-btn">View Stats</button>
        <button id="closeBtn" class="secondary-btn">Close Window</button>
      `;
      
      // Add buttons to the controls container
      document.querySelector('.controls').appendChild(completionButtons);
      
      // Add event listeners for the buttons
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