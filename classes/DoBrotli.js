const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AsyncBrotli = require('./AsyncBrotli');

module.exports = class DoBrotli {

  static shallCompress = ct =>
    !(ct.includes('event-stream')) && (
      ct.includes('text') ||
      ct.includes('javascript') ||
      ct.includes('json') ||
      ct.includes('svg')
    );

  static brotliFastCompress = new AsyncBrotli({ quality: 1 });
  static brotliRecompress = new AsyncBrotli({ quality: 11 });

  constructor(stream, response, reqH, resH, status) {
    Object.assign(this, { stream, response, reqH, resH, status });
    this.willBrotli = response && response.body &&
      !resH['content-encoding'] &&
      reqH['accept-encoding'].includes('br') &&
      DoBrotli.shallCompress(resH['content-type']);
    console.log("willBrotli", this.willBrotli);
    this.willBrotli = false;
    this.willBrotli && this.respond();
  }

  async respond() {
    const reader = response.body.getReader();
    let all = [];
    while (reader) {
      const { value, done } = await reader.read();
      value && all.push(value);
      if (done) { break; }
    }
    all = Buffer.concat(all);
    this.responseHeaders['content-length'] = all.length;
    this.responseHeaders['encoding']
    this.stream.write(await this.brotliFastCompress(all));
    this.stream.end();
  }




}