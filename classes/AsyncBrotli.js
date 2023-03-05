const path = require('path');
const { Worker } = require("worker_threads");

module.exports = class AsyncBrotli {

  processQueue = {};

  constructor(options) {
    this.options = options;
    this.worker = new Worker(path.join(__dirname, 'utils', 'brotliWorker.js'));
    this.worker.on("message", ({ id, compressed }) => {
      this.processQueue[id](compressed);
      delete this.processQueue[id];
    });
  }

  // call async!
  compress(toCompress) {
    let id = Math.random();
    return new Promise(resolve => {
      this.processQueue[id] = resolve;
      this.worker.postMessage({ id, toCompress, options: this.options });
    });
  }

}