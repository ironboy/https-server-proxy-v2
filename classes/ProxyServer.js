const { pipeline } = require('stream/promises');
const DoBrotli = require('./DoBrotli')

module.exports = class ProxyServer {

  async web(stream, headers, target) {
    const requestBody = await this.readRequestBody(stream);
    let url = headers[':path'];
    const requestHeaders = this.getHeaders({ headers });
    if (await this.handle304(stream, headers, requestHeaders, target)) {
      return;
    }
    const response = await fetch(target + url, {
      method: headers[':method'],
      headers: requestHeaders,
      body: requestBody
    });
    const responseHeaders = this.getHeaders(response);
    responseHeaders['x-powered-by'] = 'Love';
    !responseHeaders['content-security-policy']
      && (responseHeaders['content-security-policy'] = 'upgrade-insecure-requests;');
    this.makeResponse(stream, response, responseHeaders);
  }

  getHeaders(obj) {
    return Object.fromEntries(
      (obj.headers.entries ?
        [...obj.headers.entries()] : Object.entries(obj.headers))
        .map(e => [e[0].toLowerCase(), e[1]])
        .filter(e => e[0][0] !== ':')
        .filter(e => !['connection', 'keep-alive'].includes(e[0]))
    );
  }

  // call async
  readRequestBody(stream) {
    return new Promise(res => {
      const all = [];
      stream.on('readable', async (a = stream.read()) => a && all.push(a));
      stream.on('end', () => res(all.length ? Buffer.concat(all) : undefined));
    });
  }

  async handle304(stream, headers, reqH, target) {
    if (headers[':method'] !== 'GET') { return; }
    const response = await fetch(target + headers[':path'], {
      method: 'HEAD',
      headers: reqH
    });
    const resH = this.getHeaders(response);
    let okTo304 = null;
    reqH['if-none-match']
      && (okTo304 = reqH['if-none-match'] === resH['etag']);
    (okTo304 || okTo304 === null) && reqH['if-modified-since']
      && (okTo304 = reqH['if-modified-since'] === resH['last-modified']);
    okTo304 && this.makeResponse(stream, null, resH, 304);
    console.log("okTo304", okTo304);
    return okTo304;
  }

  async makeResponse(stream, response, responseHeaders, status = response.status) {
    if (stream.closed) { return; }
    if (new DoBrotli(stream, response, responseHeaders, status).willBrotli) { return; }
    stream.respond({
      ':status': status,
      ...responseHeaders
    });
    /*const reader = response?.body?.getReader();
    while (reader) {
      // console.log("IN LOOP")
      const { value, done } = await reader.read();
      //  console.log((value && value.length) || 'no value', 'done', done)
      value && stream.write(value);
      if (done) { break; }
    }
    //console.log("OUT OF LOOP")
    stream.end();*/
    const bodyStream = response?.body;
    if (!bodyStream) { stream.end(); }
    else {
      // there will be a lot of errors when streams abort
      // (for example when 'scrubbing' through an mp4) - catch and ignore
      await pipeline(bodyStream, stream).catch(e => false);
    }

  }

}