import puppeteer from 'puppeteer';

const PLATFORM_SIGNATURES = {
  'bsport': ['bsport.io', 'b-sport.io', 'app.bsport'],
  'marianatek': ['marianatek.com', 'mariana.com', '_mt=', 'healcode.com/ww/', 'branded_web'],
  'glofox': ['glofox.com', 'glofox.io', 'app.glofox'],
  'teamup': ['goteamup.com', 'team-up.com', 'bookings.goteamup'],
  'mindbody': ['healcode.com', 'mindbodyonline.com', 'clients.mindbodyonline'],
  'clubright': ['clubright.co.uk'],
  'bookwhen': ['bookwhen.com'],
  'momence': ['momence.com'],
  'fisikal': ['fisikal.com'],
  'gymcatch': ['gymcatch.com'],
  'zingfit': ['zingfit.com'],
  'pike13': ['pike13.com'],
  'vagaro': ['vagaro.com']
};

async function detectPlatform(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Listen for all network requests to catch API calls
    const apiCalls = [];
    page.on('request', req => apiCalls.push(req.url()));

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const content = await page.content();

    // Check page content and network requests
    const allContent = content + ' ' + apiCalls.join(' ');

    for (const [platform, signatures] of Object.entries(PLATFORM_SIGNATURES)) {
      for (const sig of signatures) {
        if (allContent.toLowerCase().includes(sig.toLowerCase())) {
          await browser.close();
          return { url, platform, signature: sig };
        }
      }
    }

    await browser.close();
    return { url, platform: 'unknown', signature: null };
  } catch (error) {
    await browser.close();
    return { url, platform: 'error', error: error.message };
  }
}

// Test with London fitness studios
const testUrls = [
  'https://shivashaktistudios.com/schedule/',
  'https://www.barrys.com/schedule/london-east/',
  'https://psyclelondon.com/pages/shoreditch-timetable',
  'https://www.1rebel.com/uk/buy/book-a-class',
  'https://www.kobox.co.uk/schedule/',
  'https://www.f45training.co.uk/farringdon/schedule',
  'https://www.blok.fit/schedule',
  'https://www.strongerclub.co.uk/',
  'https://www.frameltd.com/schedule',
  'https://www.thirdspace.london/timetable/',
  'https://boomcycle.co.uk/',
  'https://www.core-collective.co.uk/schedule'
];

console.log('Scanning studios for booking platforms...\n');

for (const url of testUrls) {
  const result = await detectPlatform(url);
  const status = result.platform === 'unknown' ? '?' : result.platform === 'error' ? 'X' : 'Y';
  console.log(`${status} ${result.platform.toUpperCase().padEnd(12)} - ${url.split('/')[2]}`);
}
