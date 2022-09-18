const puppeteer = require('puppeteer');
const { PendingXHR } = require('pending-xhr-puppeteer');

const fs = require('fs');
const url = require('url');
const path = require('path');
const moment = require("moment");

const args = process.argv.slice(2);
const albumsJSONFile = args[0];

const defaultViewport = {
  width: 1024,
  height: 768,
  isMobile: false,
  hasTouch: false,
  isLandscape: false,
  deviceScaleFactor: 1,
};

const args = process.argv.slice(2);
// const groupId = args[0];
const groupId = 63645687;

(async () => {
  let query = null;
  let albums = {};
  let downloads = {};

  const browser = await puppeteer.launch({
    devtools: true,
    headless: false,
    args: [
      '--window-size=1920,1080',
      //'--start-fullscreen',
    ]
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);

  // https://github.com/puppeteer/puppeteer/issues/1599
  await page._client.send('Network.enable', {
    maxResourceBufferSize: 1024 * 1204 * 100,
    maxTotalBufferSize: 1024 * 1204 * 200,
  })

  // const client = await page.target().createCDPSession();
  // await client.send('Network.enable', {
  //   maxResourceBufferSize: 1024 * 1204 * 100,
  //   maxTotalBufferSize: 1024 * 1204 * 200,
  // });

  await page.on('request', (request) => {
    if (request.url().startsWith('https://p.store.qq.com/')) {
      request.abort();
    }
    else {
      request.continue()
    }
  });

  await page.on('response', async response => {
    if (response.url().startsWith('https://qungz.photo.store.qq.com/qun-qungz')) {
      if (Object.keys(downloads).includes(response.url())) {
        console.log(response.url())
        // TODO, get raw image type from headers[content-type]
        const filePath = downloads[response.url()] + '.jpg';
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
  });

  await page.setViewport(defaultViewport);

  const pendingXHR = new PendingXHR(page);

  await page.goto('https://h5.qzone.qq.com/groupphoto/index?groupId=' + groupId + '&inqq=3');

  //// handle frame
  //const frameHandle = await page.$("iframe[id='login_frame']");
  //const frame = await frameHandle.contentFrame();

  //const [button] = await frame.$x("//a[@id='switcher_plogin']");
  //if (button) {
  //  await button.click();
  //}

  //// filling form in iframe
  //const [u] = await frame.$x("//input[@id='u']");
  //if (u) {
  //  await u.type('160703120');
  //}

  //const [p] = await frame.$x("//input[@id='p']");
  //if (p) {
  //  await p.type('kyat.station');
  //}

  //const [login_button] = await frame.$x("//input[@id='login_button']");
  //if (login_button) {
  //  await login_button.click();
  //}

  // wait for the page fully loaded
  await Promise.all([
    page.waitForSelector('#js-mod-group-photo', { timeout: 0 }),
    page.waitForNavigation({'waitUntil': 'load', timeout: 0 }),
  ])

  albums = JSON.parse(fs.readFileSync(albumsJSONFile));

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

  let evals2 = []

  for (const url of Object.keys(downloads)) {
      console.log(url);

      evals2.push(page.evaluate((url) => {
        return fetch(url, {});
      }, url));

      await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await Promise.all(evals2)

  //await browser.close();
})();
