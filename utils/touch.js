const fs = require('fs/promises');

// Touch a file
module.exports = async function touch(filePath) {
  const time = new Date();

  await fs.utimes(filePath, time, time).catch(async function (err) {
    if ('ENOENT' !== err.code) {
      throw err;
    }
    let fh = await fs.open(filePath, 'a');
    await fh.close();
  });
}