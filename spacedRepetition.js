import { StudyModeManager } from './studyModes.js';

const manager = new StudyModeManager();
const mode = await manager.activateMode('spacedRepetition');
const memories = await mode.getSessionMemories();

let currentIndex = 0;
const questionEl = document.getElementById('question');
const answerEl = document.getElementById('answer');
const progressBar = document.getElementById('progressBar');

function showMemory() {
  const memory = memories[currentIndex];
  questionEl.textContent = memory.front;
  answerEl.innerHTML = `
    ${memory.back}
    ${memory.metadata.media.images.map(img => 
      `<img src="${img}" style="max-width:100%">`).join('')}
    <div class="explanation">${memory.metadata.explanations.user}</div>
  `;
  answerEl.style.display = 'none';
  updateProgress();
}

function updateProgress() {
  progressBar.style.width = `${(currentIndex / memories.length) * 100}%`;
}

document.querySelectorAll('.rating-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const rating = parseInt(btn.dataset.rating);
    await mode.recordReview(memories[currentIndex].id, rating);
    
    currentIndex++;
    if (currentIndex < memories.length) {
      showMemory();
    } else {
      questionEl.textContent = "Session complete!";
      answerEl.style.display = 'none';
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    answerEl.style.display = answerEl.style.display === 'none' ? 'block' : 'none';
  }
});

showMemory();