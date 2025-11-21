import { startScraper } from './scrapers/engine.js';

// Grab arguments from command line
const args = process.argv.slice(2);
const gymArg = args.find(arg => arg.startsWith('--gym='));
const targetGym = gymArg ? gymArg.split('=')[1] : null;

(async () => {
  console.log('🚀 Initializing ClassHawk Scraper...');
  await startScraper(targetGym);
})();