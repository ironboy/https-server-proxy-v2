const { parentPort } = require('worker_threads');
const brotli = require('brotli');

parentPort.on('message', ({ id, toCompress, options }) => {
  let compressed = brotli.compress(toCompress, options);
  parentPort.postMessage({ id, compressed });
});