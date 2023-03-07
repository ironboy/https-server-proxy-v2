const http = require('http');
const http2 = require('http2');
const SelfSignedLocal = require('./SelfSignedLocal');
const ProxyServer = require('./ProxyServer');

module.exports = class CreateFrontServers {

  constructor({ httpPort, httpsPort, cert = 'localhost' }) {
    cert === 'localhost' && (cert = new SelfSignedLocal());
    Object.assign(this, { httpPort, httpsPort, cert });
    this.proxyServer = new ProxyServer();
    this.createHttpServer();
    this.createHttpsServer();
  }

  createHttpServer() {
    // a server that redirects to https
    const { httpPort, httpsPort } = this;
    http.createServer((req, res) => {
      let url = `https://${req.headers.host.split(':')[0]}:${httpsPort}/${req.url}`;
      while (url.slice(-1) === '/') { url = url.slice(0, -1); }
      res.writeHead(301, { 'Location': url });
      res.end();
    }).listen(httpPort);
  }

  createHttpsServer() {
    let { key, cert } = this.cert;
    let server = this.httpsServer = http2.createSecureServer({
      key,
      cert,
      maxSessionMemory: 100 /* Chrome is hungry om mp4:s */
    });
    server.on('stream', (stream, headers) => {
      //this.proxyServer.web(stream, headers, 'http://127.0.0.1:4000');
      this.proxyServer.web(stream, headers, 'https://www.nodehill.com');
    });
    server.listen(this.httpsPort);
  }

}