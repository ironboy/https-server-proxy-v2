# https-server-proxy

This is reverse-proxy meant to run at 'the front' of live web server. It:

* encrypts/decrypts https using TLS-certs (by default from LetsEncrypt)
* uses version 2 of the http-protocol
* proxies applications using http version 1.0/1.1 (such as Express applications) so that they are served using http version 2.
* lets you run one application per domain/sub-domain by pointing out the internal ports each domain should be proxied to
* allows redirects from one domain (or subdomain) to another. (For example if you want to redirect traffic from www.domain.com to domain.com - or vice versa.)
* enables you to use several certificates if necessary, 
* supports web sockets.
* compresses content using the Brotli compression algorithm and caches compressed results to avoid having to run compression again (which would be slow) on identical requests/responses. Tip: Don't compress in your application - leave it to the proxy...

### Install

```
npm install https-reverse-proxy
```

### Basic usage
Call **proxy** with the name of your certificate as the first argument and a mapping object between domains/subdomain-names and internal ports as your second argument. You can also choose to redirect one domain to another (see below).

```js
const proxy = require('https-reverse-proxy');

proxy('some.domain.org' /*cert name*/, {
  'some.domain.org': 3002,
  'domain.com': 3003,
  'www.domain.com': { redirect: "domain.com" }
});
```

#### As an ES module
If you want to use *https-reverse-proxy* as an ES-module (and thus have "type":"module" in your package.json file) simply replace the require statement with:

```js
import proxy from 'https-server-proxy/es.mjs';
```

---

(If you need to use several certificates then add another cert-name as argument 3, the mapping for domains in this certificate as argument 4 etc.)

**Note:** The **cert name** is the name of a subfolder in the folder *pathToCerts* (default: */etc/letsencrypt/live*). Each cert folder must contain the two files *privkey.pem* and *fullchain.pem*. This is the standard for LetsEncrypt certificates obtained using **certbot**. (If you have obtained a certificate with different file names for the *pem*-files, then rename them.)

### Settings
The *default settings should be fine for most types of usage*. But you can change them if you want before you set up your proxy.

The default values are listed below - you can change one, many or all of them by calling **proxy.settings()**:

```js
const proxy = require('https-reverse-proxy');

proxy.settings({
  httpPort: 80,
  httpsPort: 443,
  pathToCerts: '/etc/letsencrypt/live',
  xPoweredBy: 'Love',
  http2MaxChunk: 8192,
  http2MaxStreams: 80,
  brotliCacheMaxSizeMb: 50,
  /* 1-11, initial fast response when doing brotli */
  brotliFastQuality: 1,
  /* 1-11, recompress better when we have time left */
  brotliRecompressQuality: 11,
  /* compresss if true, ct = content-type header */
  brotliCompress: ct => 
    ct.includes('text') ||
    ct.includes('javascript') ||
    ct.includes('json') ||
    ct.includes('svg')
});

proxy(/* see previous example */);
```

---

#### Roadmap, dependencies, inner workings etc
As of 2 March 2023 (one week after initial release):
* We are using the [**spdy** package](https://www.npmjs.com/package/spdy) for http2 and tls encryption. The package is showing its age when it comes to lack of updates etc but makes it simple to proxy applications running http/1.1 (like Express based applications). We have patched **spdy** so that it works fine for our purposes in Node 18.14.2 LTS and hopefully for a good while ahead. 
* In the long run we might look at [uWeBSockets](https://github.com/uNetworking/uWebSockets.js) to replace **spdy** and gain http3 support. (If *uWebSockets* support for http3 moves from experimental to stable.)
* We are using the [**brotli** package](https://www.npmjs.com/package/brotli) for brotli compression. It works fine but is synchronous. We made it asynchronous by creating a worker process for fast initial compression and another one for slower (but better) recompression. Currently one worker is used for each but we might move to worker pools (with available settings for number of workers) if that will benefit speed on larger servers.
* We are storing the results of brotli compression in a memory cache based on content (original content as SHA-2 hash keys) rather than url:s to make sure the cache is safe even if you're looking at personal dynamic content. We might add the option to have a disk based cache as well (or instead) - that could be bigger and wouldn't reset on restarts of the proxy server.
* We are using the [**http-proxy** package](https://www.npmjs.com/package/http-proxy) for the actual proxying. It is a stable fast proxy (and has been so for years). It does support proxying to other servers as well (not just to internal ports as we use it right now). We might add the option to proxy to other servers soon - but initially we envisioned this app as a proxy in a 'one server does it all with diffrent apps on different ports' situation.
* **TO DO**: Add support for event-streams (web sockets work already). Check performance when streaming larger files (videos etc). Also: Double check that cookies and sessions work flawlessly in different environments.
