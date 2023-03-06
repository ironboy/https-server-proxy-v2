const { pipeline } = require('stream/promises');
const DoBrotli = require('./DoBrotli')

module.exports = class ProxyServer {

  async web(stream, headers, target) {
    let url = headers[':path'];
    const requestBody = await this.getRequestBody(stream);
    const requestHeaders = this.getHeaders({ headers }, requestBody);
    if (await this.handle304(stream, headers, requestHeaders, target)) {
      return;
    }
    const method = headers[':method'], response = await fetch(target + url, {
      method,
      headers: requestHeaders,
      body: requestBody
    });
    const responseHeaders = this.getHeaders(response);
    this.makeResponse(stream, response, requestHeaders, responseHeaders, method);
  }

  async handle304(stream, headers, reqH, target) {
    if (headers[':method'] !== 'GET') { return; }
    const response = await fetch(target + headers[':path'], {
      method: 'HEAD', headers: reqH
    });
    const resH = this.getHeaders(response);
    let okTo304 = null;
    reqH['if-none-match']
      && (okTo304 = reqH['if-none-match'] === resH['etag']);
    (okTo304 || okTo304 === null) && reqH['if-modified-since']
      && (okTo304 = reqH['if-modified-since'] === resH['last-modified']);
    if (okTo304) {
      delete resH['content-length'];
      delete resH['content-encoding'];
      this.makeResponse(stream, null, reqH, resH, 'GET', 304);
      return true
    }
  }

  getHeaders(obj, requestBody) {
    const h = Object.fromEntries(
      (obj.headers.entries ?
        [...obj.headers.entries()] : Object.entries(obj.headers))
        .map(e => [e[0].toLowerCase(), e[1]])
        .filter(e => e[0][0] !== ':')
        .filter(e => !['connection', 'keep-alive'].includes(e[0])));
    if (!(obj instanceof Response)) {
      h['content-length'] = (requestBody || '').length + '';
      h['content-length'] === '0' && delete h['content-length'];
    }
    else {
      Object.assign(h, {
        'x-powered-by': 'Love',
        'content-security-policy': 'upgrade-insecure-requests;',
        'access-control-allow-origin': '*'
      });
    }
    return h;
  }

  // call async
  getRequestBody(stream) {
    return new Promise(res => {
      const all = [];
      stream.on('readable', (a = stream.read()) => a && all.push(a));
      stream.on('end', () => res(all.length ? Buffer.concat(all) : undefined));
    });
  }

  async makeResponse(stream, response, reqH, resH, method, status = response.status) {
    if (stream.closed) { return; }
    if (method === 'GET' && +status === 200 &&
      (await (new DoBrotli(stream, response, reqH, resH, status)).willBrotli)) {
      return;
    }
    stream.respond({ ':status': status, ...resH });
    const bodyStream = response?.body;
    if (!bodyStream) { stream.end(); }
    else {
      // there will be a lot of errors when streams abort
      // (for example when 'scrubbing' through an mp4) - catch and ignore
      await pipeline(bodyStream, stream).catch(e => false);
    }
  }

}