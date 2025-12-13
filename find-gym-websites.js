// find-gym-websites.js
// Script to find real website URLs for BSport studios using DuckDuckGo HTML search

import fs from 'fs';

const DELAY_MS = 1500; // Delay between searches

async function searchDuckDuckGo(query) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html'
    }
  });

  const html = await res.text();

  // Extract URLs from DuckDuckGo results
  // DuckDuckGo wraps URLs in a tracking redirect, but the actual URL is in the uddg param
  const urlMatches = html.match(/uddg=([^&"]+)/g) || [];

  const urls = urlMatches
    .map(match => {
      try {
        return decodeURIComponent(match.replace('uddg=', ''));
      } catch {
        return null;
      }
    })
    .filter(url => {
      if (!url) return false;
      // Skip social media, directories, booking platforms
      const skip = [
        'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
        'youtube.com', 'yelp.com', 'tripadvisor.com', 'classpass.com',
        'bsport.io', 'duckduckgo.com', 'wikipedia.org', 'amazon.',
        'reddit.com', 'pinterest.com', 'tiktok.com'
      ];
      return !skip.some(s => url.includes(s));
    });

  return urls[0] || null;
}

async function findGymWebsites() {
  const dataFile = './data/bsport-london-studios.json';
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const studios = data.studios || [];

  console.log(`\n🔍 Finding websites for ${studios.length} BSport studios using DuckDuckGo...\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 0; i < studios.length; i++) {
    const studio = studios[i];

    // Skip if already has websiteUrl
    if (studio.websiteUrl || studio.scheduleUrl) {
      console.log(`✓ [${i+1}/${studios.length}] ${studio.name} - already has URL`);
      skipped++;
      continue;
    }

    try {
      // Search for gym website
      const query = `${studio.name} london fitness studio book classes`;
      const url = await searchDuckDuckGo(query);

      if (url) {
        // Clean URL - just keep the origin
        const parsed = new URL(url);
        studio.websiteUrl = parsed.origin;
        updated++;
        console.log(`+ [${i+1}/${studios.length}] ${studio.name} -> ${parsed.origin}`);
      } else {
        console.log(`? [${i+1}/${studios.length}] ${studio.name} - no website found`);
        notFound++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, DELAY_MS));

    } catch (e) {
      console.log(`✗ [${i+1}/${studios.length}] ${studio.name} - error: ${e.message}`);
      notFound++;
    }
  }

  // Save updated data
  data.studios = studios;
  data.websitesUpdated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already had URL): ${skipped}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`\n✅ Saved to ${dataFile}`);
}

findGymWebsites().catch(console.error);
