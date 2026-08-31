(function () {
  class HistoryStore {
    constructor(limit = 100) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
    push(snapshot, label = 'Edit') { this.undoStack.push({ snapshot: JSON.stringify(snapshot), label, at: Date.now() }); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; }
    undo(current) { const previous = this.undoStack.pop(); if (!previous) return null; this.redoStack.push({ snapshot: JSON.stringify(current), label: 'Redo', at: Date.now() }); return JSON.parse(previous.snapshot); }
    redo(current) { const next = this.redoStack.pop(); if (!next) return null; this.undoStack.push({ snapshot: JSON.stringify(current), label: 'Undo', at: Date.now() }); return JSON.parse(next.snapshot); }
    clear() { this.undoStack = []; this.redoStack = []; }
  }
  window.msDesignStudioHistory = HistoryStore;
})();
