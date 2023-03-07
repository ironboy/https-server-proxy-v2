module.exports = class ProxyHelpers {
  static getHeaders(obj, requestBody) {
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
  static getRequestBody(stream) {
    return new Promise(res => {
      const all = [];
      stream.on('readable', (a = stream.read()) => a && all.push(a));
      stream.on('end', () => res(all.length ? Buffer.concat(all) : undefined));
    });
  }

}