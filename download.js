const fs = require('fs');
const url = require('url');
const path = require('path');
const moment = require("moment");

const fetch = require('node-fetch');

const args = process.argv.slice(2);
const albumsJSONFile = args[0];

(async () => {
  let albums = {};

  albums = JSON.parse(fs.readFileSync(albumsJSONFile));

  let downloads = {};

  for (const album of Object.values(albums)) {
    const folder = moment(album.createtime, 'YYYY-MM-DD HH:mm:ss').format("YYYY-MM-DD") + '.' + album.title.replace('/','');

    fs.mkdirSync(path.join(__dirname, 'photos', folder), { recursive: true });

    for (const photo of Object.values(album.photos)) {
      let photourl = Object.values(photo.photourl).pop().url;

      let urlinfo = url.parse(photourl, true);
      let p = urlinfo.pathname.split('/');
      p[p.length - 1] = '0'
      urlinfo.pathname = p.join('/');
      urlinfo.hash = null;
      urlinfo.query = null;
      urlinfo.search = null;
      urlinfo.protocol = 'https:';
      photourl = url.format(urlinfo);

      let filePath = path.join(__dirname, 'photos', folder, photo.sloc) + '.jpg'
      if (!fs.existsSync(filePath)) {
        downloads[photourl] = path.join(__dirname, 'photos', folder, photo.sloc)
      }
    }
  }

  for (const url of Object.keys(downloads)) {
    const response = await fetch(url)

    if (response.url.startsWith('https://qungz.photo.store.qq.com/qun-qungz')) {
      if (Object.keys(downloads).includes(response.url)) {
        console.log(response.url)
        // TODO, get raw image type from headers[content-type]
        const filePath = downloads[response.url] + '.jpg';
        console.log(filePath)
        if (!fs.existsSync(filePath)) {
          response.buffer().then(file => {
            const writeStream = fs.createWriteStream(filePath);
            writeStream.write(file);
          });
        }
        else {
          // TODO, file exists, compare file size
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
})();
