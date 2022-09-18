const puppeteer = require('puppeteer-core');
const { PendingXHR } = require('pending-xhr-puppeteer');

const fs = require('fs');
const url = require('url');
const path = require('path');
const moment = require("moment");


const defaultViewport = {
  width: 1024,
  height: 768,
  isMobile: false,
  hasTouch: false,
  isLandscape: false,
  deviceScaleFactor: 1,
};

const args = process.argv.slice(2);
const groupId = args[0];

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
  // Requires puppeteer@13.6.0
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
    // catch the albums info
    if (response.url().startsWith('https://h5.qzone.qq.com/proxy/domain/u.photo.qzone.qq.com/cgi-bin/upp/qun_list_album_v2')) {
      query = url.parse(response.url(), true).query

      const body = await response.text();
      const data = JSON.parse(body.replace(/^shine._Callback\(/,'').replace(/\);$/,''))

      data.data.album.forEach(e => {
        // keep createtime, id, photocnt, title, updatetime, desc
        let n = {}
        n.id = e.id
        n.title = e.title
        n.desc = e.desc
        n.updatetime = e.updatetime
        n.createtime = e.createtime
        n.photos = {};
        n.photocnt = e.photocnt
        albums[n.id] = n
      });
    }

    // catch the photos info
    if (response.url().startsWith('https://h5.qzone.qq.com/groupphoto/inqq') && response.request().method() == 'POST') {
      if (response.status() == 200) {
        const body = await response.json();
        let albuminfo = body.data.albuminfo;
        if (body.data.photolist) {
          body.data.photolist.forEach(e => {
            // sloc, lloc, origin_height, origin_size, origin_width, photourl, realLloc
            let n = {}
            n.sloc = e.sloc
            n.lloc = e.lloc
            n.origin_size = e.origin_size
            n.origin_width = e.origin_width
            n.origin_height = e.origin_height
            n.photourl = e.photourl
            n.realLloc = e.realLloc
            albums[albuminfo.albumid].photos[n.sloc] = n
          });
        }
      }
      // TODO handle possibility of 502 errors
      else {
        console.log(response.status())
        console.log(await response.text())
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

  // find and click the album tab
  const [albums_tab] = await page.$x("//li[@class='js-tab'][@data-mod='albumlist']/a");
  if (albums_tab) {
    await albums_tab.click();

    // automatically scroll the tab
    let lastHeight = await page.evaluate('document.body.scrollHeight');
    while (true) {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(2000); // sleep a bit
        let newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) {
            break;
        }
        lastHeight = newHeight;
    }

    // console.log(albums);

    let evals = [];
    for (const album of Object.values(albums)) {
      console.log(album);

      let pages = Math.ceil(album.photocnt / 40);

      for(let i = 0; i <= pages; i++) {
        let start = 40 * i;

        evals.push(page.evaluate((query, album, start) => {
          let attach_info = '';
          if (start > 0) {
            attach_info = 'start_count%3D' + start;
          }

          // fetch multiple times by the photocnt and devided by 40
          return fetch("https://h5.qzone.qq.com/groupphoto/inqq?g_tk=" + query.g_tk +  "&qzonetoken=" + query.qzonetoken, {
            "method": "POST",
            "headers": {
              "accept": "application/json, text/javascript, */*; q=0.01",
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              "x-requested-with": "XMLHttpRequest",
            },
            "body": "qunId=" + query.qunId + "&albumId=" + album.id + "&uin=" + query.uin + "&start=" + start + "&num=36&getCommentCnt=0&getMemberRole=1&hostUin=" + query.uin + "&getalbum=1&platform=qzone&inCharset=utf-8&outCharset=utf-8&source=qzone&cmd=qunGetPhotoList&qunid=" + query.qunid + "&albumid=" + album.id + "&attach_info=" + attach_info,
          });
        }, query, album, start));

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await Promise.all( evals + [ pendingXHR.waitForAllXhrFinished() ]);

    Object.values(albums).forEach(album => {
      if (album.photocnt != Object.keys(album.photos).length) {
        console.log(album.title);
        console.log(album.photocnt);
        console.log(Object.keys(album.photos).length);
        console.error('error!');
      }
    });

    let file = moment().format("YYYYMMDDHHmmss") + '.json'

    fs.writeFileSync(file, JSON.stringify(albums));
  }

  //await browser.close();
})();
