import puppeteer from 'puppeteer';
import configs from './configs.js';
import scrape1Rebel from './extractors/1rebel.js';
import scrapePsycle from './extractors/psycle.js';
import scrapeThreeTribes from './extractors/threeTribes.js';
import scrapeBSTLagree from './extractors/bstLagree.js';
import scrapeShivaShakti from './extractors/shivaShakti.js';
import scrapeVirginActive from './extractors/virginActive.js'; // <--- New Import
import { saveToSupabase } from '../utils/supabase.js';

async function startScraper(gymName) {
  console.log(`Starting Scraper Engine for: ${gymName || 'ALL'}...`);

  // NUCLEAR LAUNCH CONFIGURATION (Needed for Shiva Shakti/BSport)
  const browser = await puppeteer.launch({
    headless: true, // Keep true for cloud
    ignoreHTTPSErrors: true, 
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  let results = [];

  try {
    // 1. Run 1Rebel
    if (gymName === 'onerebel' || !gymName) {
        console.log('--- Running 1Rebel ---');
        const data = await scrape1Rebel(browser, configs.onerebel);
        results = results.concat(data);
    }

    // 2. Run Psycle
    if (gymName === 'psycle' || !gymName) {
        console.log('--- Running Psycle ---');
        const data = await scrapePsycle(browser, configs.psycle);
        results = results.concat(data);
    }

    // 3. Run 3Tribes
    if (gymName === 'threetribes' || !gymName) {
        console.log('--- Running 3Tribes ---');
        const data = await scrapeThreeTribes(browser, configs.threetribes);
        results = results.concat(data);
    }

    // 4. Run BST Lagree
    if (gymName === 'bstlagree' || !gymName) {
        console.log('--- Running BST Lagree ---');
        const data = await scrapeBSTLagree(browser, configs.bstlagree);
        results = results.concat(data);
    }

    // 5. Run Shiva Shakti
    if (gymName === 'shivashakti' || !gymName) {
        console.log('--- Running Shiva Shakti ---');
        const data = await scrapeShivaShakti(browser, configs.shivashakti);
        results = results.concat(data);
    }

    // 6. Run Virgin Active (NEW)
    if (gymName === 'virginactive' || !gymName) {
        console.log('--- Running Virgin Active ---');
        const data = await scrapeVirginActive(browser, configs.virginactive);
        results = results.concat(data);
    }

    console.log('-------------------------');
    console.log(`SCRAPE COMPLETE. Total Classes Found: ${results.length}`);

    if (results.length > 0) {
        await saveToSupabase(results);
    } else {
        console.log('[Engine] No classes found to save.');
    }

  } catch (error) {
    console.error('[Engine] Critical Error:', error);
  } finally {
    await browser.close();
  }
}

export { startScraper };