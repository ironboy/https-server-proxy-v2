const { parentPort } = require('worker_threads');
const fs = require('fs/promises');
const path = require('path');

parentPort.on('message', async ({ id, maxSizeBytes, dir }) => {
  const startTime = Date.now();
  let files = (await fs.readdir(dir))
    .filter(x => x.slice(-3) === '.br');
  let stats = await Promise.all(files.map(x => fs.stat(path.join(dir, x)).catch(e => 0)));
  let joined = files.map((x, i) => [x, stats[i].mtime,
    Math.ceil(stats[i].size / stats[i].blksize) * stats[i].blksize]);
  joined.sort((a, b) => a[1] > b[1] ? -1 : 1)
  let totalSize = joined.reduce((a, c) => a + c[2], 0);
  let removed = [];
  while (totalSize > maxSizeBytes) {
    let toRemove = joined.pop();
    removed.push(fs.rm(path.join(dir, toRemove[0])).catch(e => 0));
    totalSize -= toRemove[2];
  }
  await Promise.all(removed);
  const timeTaken = Date.now() - startTime;
  parentPort.postMessage({ id, timeTaken, removedFiles: removed.length });
});