const { pipeline } = require('stream/promises');
const { getHeaders, getRequestBody } = require('./ProxyHelpers');
const DoBrotli = require('./DoBrotli')

module.exports = class ProxyServer {

  async web(stream, headers, target) {
    Object.assign(this, { getHeaders, getRequestBody });
    let url = headers[':path'];
    this.startTime = Date.now();
    const requestBody = await this.getRequestBody(stream);
    const requestHeaders = this.getHeaders({ headers }, requestBody);
    if (await this.handle304(stream, headers, requestHeaders, target)) {
      return;
    }
    const method = headers[':method'];
    const response = await fetch(target + url, {
      method,
      headers: requestHeaders,
      body: requestBody
    }).catch(this.errorResponse);
    const responseHeaders = this.getHeaders(response);
    this.makeResponse(stream, response, requestHeaders, responseHeaders, method);
  }

  async handle304(stream, headers, reqH, target) {
    let try304 =
      headers[':method'] === 'GET' && (
        headers['if-modified-since'] ||
        headers['if-none-match']
      );
    if (!try304) { return; }
    const response = await fetch(target + headers[':path'], {
      method: 'HEAD', headers: reqH
    }).catch(this.errorResponse);
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
      return true;
    }
  }

  async makeResponse(stream, response, reqH, resH, method, status = response.status) {
    if (stream.closed) { return; }
    let doBrotli;
    if (method === 'GET' && +status === 200) {
      let timeTakenMs = Date.now() - this.startTime;
      // don't try to brotli compress if time taken >= 20 sec
      // because probably long polling, otherwise try
      if (timeTakenMs < 20000) {
        doBrotli = new DoBrotli(stream, response, reqH, resH, status);
        if (await doBrotli.willBrotli) { return; }
      }
    }
    stream.respond({ ':status': status, ...resH });
    const bodyStream = response?.body;
    // probably 304 -> no response body
    if (!bodyStream) { stream.end(); }
    // tried to brotli but compression failed
    else if (doBrotli && !(await doBrotli.willBrotli) && doBrotli.uncompressed) {
      stream.write(doBrotli.uncompressed);
      stream.end();
    }
    // pipe the response stream to the output stream 
    // (for binaries / non - compressed)
    else {
      // there will be a lot of errors when streams abort
      // (for example when 'scrubbing' through an mp4) 
      // - catch and ignore these
      await pipeline(bodyStream, stream).catch(e => false);
    }
  }

  errorResponse(e) {
    console.log(e)
    var blob = new Blob(['Service Unavailable'], { type: 'text/plain' });
    var init = { "status": 503, "statusText": "Service Unavailable" };
    return new Response(blob, init);
  }

}