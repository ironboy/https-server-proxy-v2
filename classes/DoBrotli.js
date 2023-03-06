const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AsyncBrotli = require('./AsyncBrotli');
const touch = require('../utils/touch');

module.exports = class DoBrotli {

  static pathToCache = path.join(__dirname, '../', '.bin', 'brotli-cache');
  static fastCompress = new AsyncBrotli({ quality: 1 });
  static recompress = new AsyncBrotli({ quality: 11 });

  static shallCompress = ct =>
    !(ct.includes('event-stream')) && (
      ct.includes('text') ||
      ct.includes('javascript') ||
      ct.includes('json') ||
      ct.includes('svg')
    );

  constructor(stream, response, reqH, resH, status) {
    this.willBrotli = new Promise(res => this.promiseResolve = res);
    Object.assign(this, { stream, response, reqH, resH, status });
    (+status === 200 && response && response.body &&
      !resH['content-encoding'] &&
      reqH['accept-encoding'].includes('br') &&
      DoBrotli.shallCompress(resH['content-type'])
    ) ? this.respond() : this.promiseResolve(false);
  }

  async respond() {
    const reader = this.response.body.getReader();
    let all = [];
    while (reader) {
      const { value, done } = await reader.read();
      value && all.push(value);
      if (done) { break; }
    }
    all = Buffer.concat(all);
    const compressed = await this.getBrotlied(all);
    this.promiseResolve(!!compressed);
    if (!compressed) { return; }
    this.resH['content-length'] = compressed.length;
    this.resH['content-encoding'] = 'br';
    this.stream.respond({ ':status': 200, ...this.resH });
    this.stream.write(compressed);
    this.stream.end();
  }

  async getBrotlied(all) {
    const { rm, wf, rf } = this.fsActions();
    const hash = crypto.createHash('sha256').update(all).digest('hex');
    let cached = await rf(hash + '.br') || await rf(hash + '.fast.br');
    if (cached) { return cached; }
    let data = await DoBrotli.fastCompress.compress(all);
    data && wf(hash + '.fast.br', data);
    data && DoBrotli.recompress.compress(all)
      .then(x => wf(hash + '.br', x).then(() => rm(hash + '.fast.br')));
    return data;
  }

  fsActions() {
    const p = DoBrotli.pathToCache, e = () => false;
    return {
      rm: file => fs.rm(path.join(p, file)).catch(e),
      wf: (file, x) => fs.writeFile(path.join(p, file), x).catch(e),
      rf: async file => {
        let data = await fs.readFile(path.join(p, file)).catch(e);
        data && touch(path.join(p, file));
        return data;
      }
    }
  }

}