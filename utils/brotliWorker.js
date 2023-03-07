const { parentPort } = require('worker_threads');
const zlib = require('zlib');

parentPort.on('message', ({ id, toCompress, options }) => {
  zlib.brotliCompress(toCompress, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: options.quality,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: toCompress.length
    }
  }, (err, buffer) => parentPort.postMessage({ id, compressed: err ? false : buffer }));
});