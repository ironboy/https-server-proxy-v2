const path = require('path');
const { Worker } = require("worker_threads");

module.exports = class BrotliPrune {

  maxSize = '500MB';
  dir = path.join(__dirname, '../', '.bin', 'brotli-cache');

  processQueue = {};

  constructor() {
    this.worker = new Worker(path.join(__dirname, '../', 'utils', 'brotliPrunerWorker.js'));
    this.worker.on("message", ({ id, timeTaken, removedFiles }) => {
      this.processQueue[id]({ timeTaken, removedFiles });
      delete this.processQueue[id];
    });
  }

  // call async!
  prune() {
    let dir = this.dir;
    let maxSizeBytes = this.sizeInBytes(this.maxSize);
    let id = Math.random();
    return new Promise(resolve => {
      this.processQueue[id] = resolve;
      this.worker.postMessage({ id, maxSizeBytes, dir });
    });
  }

  sizeInBytes(size) {
    return parseFloat(size) * 1024 ** (
      ['KB', 'MB', 'GB', 'TB'].indexOf((size + '')
        .trim().slice(-2).toUpperCase()) + 1)
  }

}