const crypto = require('crypto');

module.exports = class DoBrotli {

  constructor(stream, response, responseHeaders, status) {
    this.willBrotli = false;
  }

}