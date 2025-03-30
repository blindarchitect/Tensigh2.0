document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const totalMemoriesEl = document.getElementById('totalMemories');
  const reviewedMemoriesEl = document.getElementById('reviewedMemories');
  const streakEl = document.getElementById('streak');
  const lastReviewEl = document.getElementById('lastReview');
  const dueReviewsEl = document.getElementById('dueReviews');
  
  // Rating bar elements
  const ratingBars = {
    again: { bar: document.getElementById('againBar'), count: document.getElementById('againCount') },
    hard: { bar: document.getElementById('hardBar'), count: document.getElementById('hardCount') },
    good: { bar: document.getElementById('goodBar'), count: document.getElementById('goodCount') },
    easy: { bar: document.getElementById('easyBar'), count: document.getElementById('easyCount') }
  };

  try {
    // Load all data
    const { memories = [], stats = {} } = await chrome.storage.local.get(['memories', 'stats']);
    
    // Update basic stats
    totalMemoriesEl.textContent = memories.length;
    reviewedMemoriesEl.textContent = stats.reviewed || 0;
    streakEl.textContent = stats.streak || 0;
    
    // Format and display last review date
    if (stats.lastReviewDate) {
      const lastReview = new Date(stats.lastReviewDate);
      lastReviewEl.textContent = lastReview.toLocaleDateString();
    } else {
      lastReviewEl.textContent = 'Never';
    }

    // Calculate rating distribution
    const ratingCounts = {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0
    };

    memories.forEach(memory => {
      if (memory.lastRating) {
        switch (memory.lastRating) {
          case 1: ratingCounts.again++; break;
          case 2: ratingCounts.hard++; break;
          case 3: ratingCounts.good++; break;
          case 4: ratingCounts.easy++; break;
        }
      }
    });

    // Update rating bars
    const totalRatings = Object.values(ratingCounts).reduce((a, b) => a + b, 0);
    if (totalRatings > 0) {
      Object.entries(ratingCounts).forEach(([rating, count]) => {
        const percentage = (count / totalRatings) * 100;
        ratingBars[rating].bar.style.width = `${percentage}%`;
        ratingBars[rating].count.textContent = count;
      });
    }

    // Get and display due reviews
    const dueMemories = memories.filter(m => new Date(m.nextReview) <= new Date());
    if (dueMemories.length > 0) {
      dueReviewsEl.innerHTML = `
        <div class="due-count">${dueMemories.length} memories due for review</div>
        <div class="due-list">
          ${dueMemories.slice(0, 5).map(m => `
            <div class="due-item">
              <div class="due-question">${m.front}</div>
              <div class="due-date">Due: ${new Date(m.nextReview).toLocaleDateString()}</div>
            </div>
          `).join('')}
          ${dueMemories.length > 5 ? `<div class="due-more">+${dueMemories.length - 5} more...</div>` : ''}
        </div>
      `;
    } else {
      dueReviewsEl.innerHTML = '<div class="no-due">No memories due for review</div>';
    }

  } catch (error) {
    console.error('Error loading stats:', error);
    dueReviewsEl.innerHTML = '<div class="error">Error loading statistics</div>';
  }
}); 