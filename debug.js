const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  console.log('Navigating to Shiva Shakti...');
  await page.goto('https://shivashaktistudios.com/schedule/', { waitUntil: 'networkidle2' });

  console.log('Waiting 10 seconds for widget...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'debug_shiva.png', fullPage: true });

  console.log('Saved "debug_shiva.png". Please upload this image.');
  await browser.close();
})();