
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

module.exports = class SelfSignedLocal {

  constructor() {
    const folder = [__dirname, '../', '.bin', 'localhost-self-signed'];
    const filePath1 = path.join(...folder, 'cert.pem');
    const filePath2 = path.join(...folder, 'privkey.pem');
    const daysOld = !fs.existsSync(filePath1) ? Infinity : (Date.now() - new Date(fs.statSync(filePath1).mtime).getTime()) / 1000 / 60 / 60 / 24;
    if (daysOld > 300) {
      // make new cert
      const { cert, private: key } = selfsigned.generate(
        [{ name: 'commonName', value: 'localhost' }], { days: 365 }
      );
      Object.assign(this, { cert, key });
      fs.writeFileSync(filePath1, cert, 'utf-8');
      fs.writeFileSync(filePath2, key, 'utf-8');
    }
    else {
      Object.assign(this, {
        cert: fs.readFileSync(filePath1, 'utf-8'),
        key: fs.readFileSync(filePath2, 'utf-8')
      });
    }
  }

}