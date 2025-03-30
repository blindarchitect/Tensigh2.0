class MediaCapture {
  static async captureVisibleTab() {
    return new Promise((resolve) => {
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        resolve(dataUrl);
      });
    });
  }

  static async captureSelection() {
    const [result] = await chrome.scripting.executeScript({
      func: () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        return range.getBoundingClientRect();
      }
    });
    
    if (result?.result) {
      const fullScreenshot = await this.captureVisibleTab();
      return this.cropImage(fullScreenshot, result.result);
    }
    return null;
  }

  static async recordAudio(duration) {
    return new Promise((resolve) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const recorder = new MediaRecorder(stream);
          const chunks = [];
          
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            resolve(URL.createObjectURL(blob));
          };
          
          recorder.start();
          setTimeout(() => recorder.stop(), duration * 1000);
        });
    });
  }
}