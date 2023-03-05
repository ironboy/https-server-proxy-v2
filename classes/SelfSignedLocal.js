
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

module.exports = class SelfSignedLocal {

  constructor() {
    const filePath = path.join(__dirname, '../', 'bin', 'selfSigned.json');
    const daysOld = !fs.existsSync(filePath) ? Infinity : (Date.now() - new Date(fs.statSync(filePath).mtime).getTime()) / 1000 / 60 / 60 / 24;
    if (daysOld > 300) {
      // make new cert
      const { private: key, cert } = selfsigned.generate(
        [{ name: 'commonName', value: 'localhost' }], { days: 365 }
      );
      Object.assign(this, { key, cert });
      fs.writeFileSync(filePath, JSON.stringify(this, '', '  '), 'utf-8');
    }
    else {
      Object.assign(this, require(filePath));
    }
  }

}