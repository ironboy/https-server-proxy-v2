const http = require('http');
const http2 = require('http2');
const SelfSignedLocal = require('./SelfSignedLocal');
const ProxyServer = require('./ProxyServer');

module.exports = class CreateFrontServers {

  constructor({
    httpPort = 80,
    httpsPort = 443,
    cert = 'localhost'
  }) {
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
      //allowHTTP1: true, /* needed for web sockets */
      maxSessionMemory: 100 /* Chrome is hungry om mp4:s */
    });
    server.on('stream', (stream, headers) => {
      // https://java21h.lms.nodehill.se/
      //this.proxyServer.web(stream, headers, 'https://java21h.lms.nodehill.se');
      this.proxyServer.web(stream, headers, 'https://filmvisarna-team5.nodehill.se');
      //this.proxyServer.web(stream, headers, 'http://localhost:5173');
      // this.proxyServer.web(stream, headers, 'https://www.nodehill.com');
    });
    /*server.on('upgrade', (req, socket, head) => {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
        'Upgrade: WebSocket\r\n' +
        'Connection: Upgrade\r\n' +
        '\r\n');
      socket.pipe(socket);
      console.log("PIPED")
    });*/
    server.listen(this.httpsPort);
  }

}