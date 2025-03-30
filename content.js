// This would handle the manual memory creation from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showMemoryDialog') {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      createMemory(selection);
    } else {
      showDialog();
    }
  }
});

function showDialog() {
  const dialog = document.createElement('div');
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.zIndex = '9999';
  dialog.style.backgroundColor = 'white';
  dialog.style.padding = '20px';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  dialog.innerHTML = `
    <h3 style="margin-top: 0;">Create Memory</h3>
    <textarea id="memoryText" style="width: 100%; min-height: 100px; margin-bottom: 10px;"></textarea>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button id="cancelBtn">Cancel</button>
      <button id="saveBtn" style="background: #3498db; color: white;">Save</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  
  document.getElementById('saveBtn').addEventListener('click', () => {
    const text = document.getElementById('memoryText').value.trim();
    if (text) {
      createMemory(text);
    }
    document.body.removeChild(dialog);
  });
}

function createMemory(text) {
  chrome.runtime.sendMessage({
    action: 'createMemory',
    text: text,
    url: window.location.href
  });
}