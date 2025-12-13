#!/usr/bin/env node
/**
 * Script to discover and populate scheduleUrl for BSport studios
 * 
 * Usage: node scripts/populate-schedule-urls.js
 * 
 * This will:
 * 1. Read data/bsport-london-studios.json
 * 2. For each studio with a websiteUrl, try common booking page patterns
 * 3. Output updated JSON to data/bsport-london-studios-updated.json
 * 4. Print a report of findings
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'bsport-london-studios.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'bsport-london-studios-updated.json');

// Common booking page URL patterns to try
const BOOKING_PATTERNS = [
  '/book',
  '/booking',
  '/timetable',
  '/schedule',
  '/classes',
  '/book-a-class',
  '/book-online',
  '/class-schedule',
  '/class-timetable',
  '/bookings',
  '/reserve',
  '/sessions'
];

// Request timeout in ms
const TIMEOUT = 8000;

// Delay between requests to be polite
const DELAY_MS = 300;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a URL exists (returns 200-399 status)
 */
async function urlExists(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });
    clearTimeout(timeoutId);
    
    // Some servers don't support HEAD, try GET if we get 405
    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        },
        redirect: 'follow'
      });
      return getResponse.ok;
    }
    
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Find the booking page URL for a studio
 */
async function findBookingUrl(websiteUrl) {
  if (!websiteUrl) return null;

  // Normalize the base URL (remove trailing slash)
  const baseUrl = websiteUrl.replace(/\/$/, '');

  for (const pattern of BOOKING_PATTERNS) {
    const testUrl = `${baseUrl}${pattern}`;
    
    if (await urlExists(testUrl)) {
      return testUrl;
    }
    
    await delay(DELAY_MS);
  }

  return null;
}

async function main() {
  console.log('🔍 BSport Schedule URL Finder\n');
  console.log('Reading studio data...');

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const studios = data.studios;

  console.log(`Found ${studios.length} studios to process\n`);

  const results = {
    found: [],
    notFound: [],
    alreadyHasScheduleUrl: [],
    noWebsiteUrl: []
  };

  for (let i = 0; i < studios.length; i++) {
    const studio = studios[i];
    const progress = `[${i + 1}/${studios.length}]`;

    // Skip if already has scheduleUrl
    if (studio.scheduleUrl) {
      console.log(`${progress} ⏭️  ${studio.name} - already has scheduleUrl`);
      results.alreadyHasScheduleUrl.push(studio);
      continue;
    }

    // Skip if no websiteUrl
    if (!studio.websiteUrl) {
      console.log(`${progress} ⚠️  ${studio.name} - no websiteUrl`);
      results.noWebsiteUrl.push(studio);
      continue;
    }

    console.log(`${progress} 🔎 ${studio.name} - checking ${studio.websiteUrl}...`);

    const bookingUrl = await findBookingUrl(studio.websiteUrl);

    if (bookingUrl) {
      console.log(`${progress} ✅ ${studio.name} - found: ${bookingUrl}`);
      studio.scheduleUrl = bookingUrl;
      results.found.push({ name: studio.name, scheduleUrl: bookingUrl });
    } else {
      console.log(`${progress} ❌ ${studio.name} - no booking page found`);
      results.notFound.push({ name: studio.name, websiteUrl: studio.websiteUrl });
    }

    // Small delay between studios
    await delay(100);
  }

  // Update the data
  data.updated = new Date().toISOString().split('T')[0];
  data.scheduleUrlsUpdated = new Date().toISOString().split('T')[0];

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\n📁 Updated JSON written to: ${OUTPUT_PATH}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Found booking URLs:        ${results.found.length}`);
  console.log(`⏭️  Already had scheduleUrl:   ${results.alreadyHasScheduleUrl.length}`);
  console.log(`❌ No booking page found:     ${results.notFound.length}`);
  console.log(`⚠️  No websiteUrl:             ${results.noWebsiteUrl.length}`);

  if (results.found.length > 0) {
    console.log('\n✅ FOUND BOOKING URLS:');
    results.found.forEach(s => console.log(`   ${s.name}: ${s.scheduleUrl}`));
  }

  if (results.notFound.length > 0) {
    console.log('\n❌ STUDIOS NEEDING MANUAL REVIEW:');
    results.notFound.forEach(s => console.log(`   ${s.name}: ${s.websiteUrl}`));
  }

  if (results.noWebsiteUrl.length > 0) {
    console.log('\n⚠️  STUDIOS WITHOUT WEBSITE URL:');
    results.noWebsiteUrl.forEach(s => console.log(`   ${s.name}`));
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);

