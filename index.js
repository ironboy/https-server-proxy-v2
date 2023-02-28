// Require dependencies (Node native)
const http = require('http');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

// Monkey patching needed before spdy require
monkeyPatchDeciever();

// Non native dependencies
const httpProxy = require('http-proxy');
const spdy = require('spdy');

let settings = {
  httpPort: 80,
  httpsPort: 443,
  pathToCerts: '/etc/letsencrypt/live',
  xPoweredBy: 'Love'
};

// args -> certificateName, routes
function createHttpsServerProxy(...args) {

  let routes = {}, currentCertName, certNameByDomain = {};

  // map certs to domains
  for (let arg of args) {
    if (typeof arg === 'string') { currentCertName = arg; }
    else {
      routes = { ...routes, ...arg };
      for (let key of Object.keys(arg)) {
        certNameByDomain[key] = currentCertName;
      }
    }
  }
  let defaultCertName = Object.values(certNameByDomain)[0];

  // Globals
  const certs = readCerts();

  // Create a new reverse proxy
  const proxy = httpProxy.createProxyServer({ selfHandleResponse: true });

  // Necessary with Node >= 15 to get spdy to work
  // (does not seem to work with default chunking from the proxy,
  //  but works if we send the whole response at once...)
  // - this is a BIG workaround don't know 
  //   how it will play with large files(videos etc)
  proxy.on('proxyRes', function (proxyRes, req, res) {
    var body = [];
    proxyRes.on('data', function (chunk) {
      body.push(chunk);
    });
    proxyRes.on('end', function () {
      for (let [header, value] of Object.entries(proxyRes.headers)) {
        res.setHeader(header, value);
      }
      console.log(req.url, proxyRes.statusCode);
      res.statusCode = proxyRes.statusCode;
      res.end(Buffer.concat(body));
    });
  });

  // Handle proxy errors - thus not breaking the whole
  // reverse-proxy app if an app doesn't answer
  proxy.on('error', function (e) {
    console.log('Proxy error', Date.now(), e);
  })

  createServer();

  // Create our servers (https with http2 and http just for redirects)
  function createServer() {

    // Further monkey patching of spdy, in this case
    // to avoid deprecation warning on ._headers (since Node 12)
    eval('spdy.response.writeHead = ' + (spdy.response.writeHead + '')
      .split('this._headers')
      .join('this.getHeaders ? this.getHeaders() : this._headers'));

    let spdyServer = spdy.createServer({
      SNICallback: lookupCert,
      key: certs[defaultCertName].key,
      cert: certs[defaultCertName].cert,
      spdy: { maxChunk: 8192, maxStreams: 80 }
    }, serveHttps).listen(settings.httpsPort);

    // Without this spdy cuts off some streams.
    // (The whole repsonse is not delivered without this!!!)
    spdyServer.on('request', (req, res) => {
      res.spdyStream && res.spdyStream.once('finish', () => res.emit('finish'));
    });

    // Make sockets work with the proxy
    spdyServer.on('upgrade', function (req, socket, head) {
      let port = routes[req.headers.host];
      let host = '127.0.0.1';
      proxy.ws(req, socket, head, { target: `ws://${host}:${port}` }, e => { });
    });

    http.createServer(serveHttp).listen(settings.httpPort);
  }

  function serveHttp(req, res) {
    // redirect to https
    let url = 'https://' + req.headers.host + req.url;
    res.writeHead(301, { 'Location': url });
    res.end();
  }

  function serveHttps(req, res) {
    // Set/replace response headers
    setResponseHeaders(req, res);
    // Routing
    let host = req.headers.host,
      url = req.url,
      portToUse;
    url += (url.slice(-1) != '/' ? '/' : '');
    for (let route in routes) {
      let port = routes[route];
      if (route.includes('/')) {
        route += (route.slice(-1) != '/' ? '/' : '')
      }
      if (route == host) {
        portToUse = port;
      }
      else if (url != '/' && (host + url).indexOf(route) == 0) {
        portToUse = port;
      }
    }
    // Redirects
    if (portToUse && portToUse.redirect) {
      let url = 'https://' + portToUse.redirect + req.url;
      res.writeHead(301, { 'Location': url });
      res.end();
    }
    // Serve the correct app for a domain
    else if (portToUse) {
      proxy.web(req, res, { target: 'http://127.0.0.1:' + portToUse });
    }
    else {
      res.statusCode = 404;
      res.end('No such url!');
    }
  }

  function setResponseHeaders(req, res) {
    // there is a built in node function called res.writeHead
    // that writes http response headers
    // store that function in another property
    res.oldWriteHead = res.writeHead;
    // and then replace it with our function
    res.writeHead = function (statusCode, headers) {
      // set/replace our own headers
      res.setHeader('x-powered-by', settings.xPoweredBy);
      // call the original write head function
      return res.oldWriteHead(statusCode, headers);
    }
    res.oldSetHeader = res.setHeader;
    res.setHeader = function (...args) {
      // If any app tries to redirect to http
      // rewrite the redirect so that it goes to https
      // (common problem with some Java Spring apps...)
      if (args[0] === 'location' && args[1].indexOf('http:') === 0) {
        args[1] = args[1].replace('http:', 'https:');
      }
      // call the original setHeader function
      return res.oldSetHeader(...args);
    }
  }

  // read https / tls (transport layer security) certs
  function readCerts() {
    let pathToCerts = settings.pathToCerts;
    let certs = {};
    let domains = fs.readdirSync(pathToCerts);
    pathToCerts.slice(-1) === '/' || (pathToCerts += '/');
    domains = domains.filter(x => fs.lstatSync(pathToCerts + x).isDirectory());
    for (let domain of domains) {
      let domainName = domain.split('-0')[0];
      certs[domainName] = {
        key: fs.readFileSync(path.join(pathToCerts, domain, 'privkey.pem')),
        cert: fs.readFileSync(path.join(pathToCerts, domain, 'fullchain.pem'))
      };
      // SecureContext is needed for SNI support
      certs[domainName].secureContext = tls.createSecureContext(certs[domainName]);
    }
    return certs;
  }

  // Support for SNI (Server Name Indication)
  // making it possible to handle more than one TLS cert
  function lookupCert(domain, callback) {
    let certName = certNameByDomain[domain];
    let theCert = certs[certName];
    if (!theCert) { return; }
    callback(null, theCert.secureContext);
  }

}

// Deceiver is part of Spdy
// and causes this deprecationWarning since Node 16:
// Access to process.binding('http_parser') is deprecated.
// -> We fix this by monkeypatching process.binding
function monkeyPatchDeciever() {
  let h = {
    HTTPParser: {
      kOnHeaders: 1,
      kOnHeadersComplete: 2,
      kOnBody: 3,
      kOnMessageComplete: 4,
      methods: [
        'DELETE', 'GET', 'HEAD',
        'POST', 'PUT', 'CONNECT',
        'OPTIONS', 'TRACE', 'COPY',
        'LOCK', 'MKCOL', 'MOVE',
        'PROPFIND', 'PROPPATCH', 'SEARCH',
        'UNLOCK', 'BIND', 'REBIND',
        'UNBIND', 'ACL', 'REPORT',
        'MKACTIVITY', 'CHECKOUT', 'MERGE',
        'M-SEARCH', 'NOTIFY', 'SUBSCRIBE',
        'UNSUBSCRIBE', 'PATCH', 'PURGE',
        'MKCALENDAR', 'LINK', 'UNLINK',
        'SOURCE'
      ]
    }
  };
  let orgBinding = process.binding;
  process.binding = (...args) => {
    if (args[0] === 'http_parser') { return h; }
    return orgBinding.apply(process, args);
  }
}

createHttpsServerProxy.settings = s => {
  settings = { ...settings, ...s };
}

module.exports = createHttpsServerProxy;