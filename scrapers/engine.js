// scrapers/engine.js
import puppeteer from 'puppeteer';
import configs from './configs.js';
import scrape1Rebel from './extractors/1rebel.js';
import scrapePsycle from './extractors/psycle.js';
import scrapeThreeTribes from './extractors/threeTribes.js';
import scrapeBSTLagree from './extractors/bstLagree.js';
import scrapeShivaShakti from './extractors/shivaShakti.js';
import scrapeVirginActive from './extractors/virginActive.js'; 
import scrapeBarrys from './extractors/barrys.js';
import scrapeMindBody from './extractors/mindbody.js';
import scrapeBSport from './extractors/bsport.js';
import scrapeFrame from './extractors/frame.js';
import { saveToSupabase } from '../utils/supabase.js';
import { checkAndNotify } from '../utils/notifier.js';

// 🛡️ SAFETY NET: Retry Logic
// This function tries to run a scraper. If it fails, it waits 2s and tries again.
async function runScraperSafe(name, scraperFn, browser, config, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`--- Running ${name} (Attempt ${i + 1}/${retries + 1}) ---`);
      const data = await scraperFn(browser, config);
      
      if (data && data.length > 0) {
        console.log(`   ✅ ${name}: Success! Found ${data.length} classes.`);
        return data;
      } else {
        console.log(`   ⚠️ ${name}: Returned 0 classes.`);
        // If it returned 0, we might want to retry depending on logic, 
        // but usually 0 means "working but empty". We'll accept it to avoid loops.
        return [];
      }
    } catch (err) {
      console.error(`   ❌ ${name}: Failed (Attempt ${i + 1}). Error: ${err.message}`);
      if (i === retries) {
        console.error(`   💀 ${name}: Giving up after ${retries + 1} attempts.`);
        return []; // Return empty so engine continues
      }
      // Wait 3 seconds before retrying
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  return [];
}

async function startScraper(gymName) {
  console.log(`\n🚀 STARTING ENGINE: ${gymName || 'ALL'}...\n`);

  const shouldRunAll = !gymName || gymName === 'all';

  // 1. Launch Browser (Optimized Args)
  const browser = await puppeteer.launch({
    headless: true, 
    ignoreHTTPSErrors: true, 
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Helps in Docker/Cloud
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
    ]
  });

  let masterList = [];

  try {
    // 2. Execute Scrapers (Sequentially to save RAM)
    
    if (shouldRunAll || gymName === '1rebel') {
        const data = await runScraperSafe('1Rebel', scrape1Rebel, browser, configs['1rebel']);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'psycle') {
        const data = await runScraperSafe('Psycle', scrapePsycle, browser, configs.psycle);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'threetribes') {
        const data = await runScraperSafe('3Tribes', scrapeThreeTribes, browser, configs.threetribes);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'bstlagree') {
        const data = await runScraperSafe('BST Lagree', scrapeBSTLagree, browser, configs.bstlagree);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'shivashakti') {
        const data = await runScraperSafe('Shiva Shakti', scrapeShivaShakti, browser, configs.shivashakti);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'virginactive') {
        const data = await runScraperSafe('Virgin Active', scrapeVirginActive, browser, configs.virginactive);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'barrys') {
        const data = await runScraperSafe('Barry\'s', scrapeBarrys, browser, configs.barrys);
        masterList = masterList.concat(data);
    }

    // DISABLED: MindBody API doesn't return UK results (0 classes found)
    // Keeping code in case API becomes available for UK later
    // if (shouldRunAll || gymName === 'mindbody') {
    //     const data = await runScraperSafe('MindBody', scrapeMindBody, browser, configs.mindbody);
    //     masterList = masterList.concat(data);
    // }

    if (shouldRunAll || gymName === 'bsport') {
        const data = await runScraperSafe('BSport', scrapeBSport, browser, configs.bsport);
        masterList = masterList.concat(data);
    }

    if (shouldRunAll || gymName === 'frame') {
        const data = await runScraperSafe('Frame', scrapeFrame, browser, configs.frame);
        masterList = masterList.concat(data);
    }

    console.log('\n-------------------------');
    console.log(`🏁 ENGINE COMPLETE. Total Classes: ${masterList.length}`);

    // Filter out online/livestream classes
    const filteredList = masterList.filter(cls => {
      const className = (cls.class_name || '').toLowerCase();
      const location = (cls.location || '').toLowerCase();
      return !className.includes('livestream') &&
             !className.includes('live stream') &&
             !className.includes('online') &&
             !location.includes('online') &&
             !location.includes('livestream');
    });

    console.log(`🌐 Filtered out ${masterList.length - filteredList.length} online classes. Remaining: ${filteredList.length}`);

    // 3. Save & Notify
    if (filteredList.length > 0) {
        await saveToSupabase(filteredList);
        await checkAndNotify(filteredList); // The "Waitlist Sniper"
    } else {
        console.log('[Engine] No classes found to save.');
    }

  } catch (error) {
    console.error('[Engine] Critical System Error:', error);
  } finally {
    console.log('[Engine] Shutting down browser...');
    await browser.close();
  }
}

export { startScraper };