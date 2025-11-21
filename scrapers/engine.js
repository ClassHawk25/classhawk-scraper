import puppeteer from 'puppeteer';
import configs from './configs.js';
import scrape1Rebel from './extractors/1rebel.js';
import scrapePsycle from './extractors/psycle.js';
import scrapeThreeTribes from './extractors/threeTribes.js';
import scrapeBSTLagree from './extractors/bstLagree.js'; // <--- IMPORT ADDED
import { saveToSupabase } from '../utils/supabase.js';
import scrapeVirginActive from './extractors/virginActive.js';

async function startScraper(gymName) {
  console.log(`Starting Scraper Engine for: ${gymName || 'ALL'}...`);

  const browser = await puppeteer.launch({
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    // 4. Run BST Lagree (NEW SECTION)
    if (gymName === 'bstlagree' || !gymName) {
        console.log('--- Running BST Lagree ---');
        const data = await scrapeBSTLagree(browser, configs.bstlagree);
        results = results.concat(data);
    }
    // 5. Run Virgin Active (NEW)
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