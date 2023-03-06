const { time } = require('console');
const fs = require('fs/promises');
const path = require('path');

class BrotliPrune {

  maxSize = '20KB';
  dir = path.join(__dirname, '../', '.bin', 'brotli-cache');

  sleep = ms => new Promise(res => setTimeout(res, ms));

  constructor() {
    this.prune();
  }

  async prune() {
    while (true) {
      const maxSizeBytes = this.sizeInBytes(this.maxSize);
      const startTime = Date.now();
      let files = (await fs.readdir(this.dir))
        .filter(x => x.slice(-3) === '.br');
      let stats = await Promise.all(files.map(x => fs.stat(path.join(this.dir, x))));
      let joined = files.map((x, i) => [x, stats[i].mtime,
        Math.ceil(stats[i].size / stats[i].blksize) * stats[i].blksize]);
      joined.sort((a, b) => a[1] > b[1] ? -1 : 1)
      let totalSize = joined.reduce((a, c) => a + c[2], 0);
      let removed = [];
      while (totalSize > maxSizeBytes) {
        let toRemove = joined.pop();
        removed.push(fs.rm(path.join(this.dir, toRemove[0])).catch(e => 0));
        totalSize -= toRemove[2];
      }
      await Promise.all(removed);
      const timeTaken = Date.now() - startTime;
      // console.log('Prune, time taken (ms)', timeTaken);
      await this.sleep(10000);
    }
  }

  sizeInBytes(size) {
    return parseFloat(size) * 1024 ** (
      ['KB', 'MB', 'GB', 'TB'].indexOf((size + '')
        .trim().slice(-2).toUpperCase()) + 1)
  }

}

new BrotliPrune();