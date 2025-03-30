class MindMap {
  constructor(container, memories) {
    this.container = container;
    this.memories = memories;
    this.nodes = [];
    this.init();
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    // Create nodes from memories
    this.nodes = this.memories.map(memory => ({
      id: memory.id,
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      text: memory.front,
      connections: []
    }));
    
    // Create connections based on tags
    this.nodes.forEach(node => {
      const memory = this.memories.find(m => m.id === node.id);
      memory.tags.forEach(tag => {
        const similar = this.memories.filter(m => 
          m.id !== memory.id && m.tags.includes(tag));
        similar.forEach(m => {
          if (!node.connections.includes(m.id)) {
            node.connections.push(m.id);
          }
        });
      });
    });
    
    this.draw();
  }

  draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw connections
    this.nodes.forEach(node => {
      node.connections.forEach(connId => {
        const target = this.nodes.find(n => n.id === connId);
        if (target) {
          this.ctx.beginPath();
          this.ctx.moveTo(node.x, node.y);
          this.ctx.lineTo(target.x, target.y);
          this.ctx.stroke();
        }
      });
    });
    
    // Draw nodes
    this.nodes.forEach(node => {
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
      this.ctx.fillStyle = '#1a73e8';
      this.ctx.fill();
      
      // Draw text
      this.ctx.fillStyle = '#000';
      this.ctx.fillText(
        node.text.substring(0, 15) + (node.text.length > 15 ? '...' : ''),
        node.x - 30,
        node.y - 25
      );
    });
  }
}