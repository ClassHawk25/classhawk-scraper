// utils/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { formatTo24Hr } from './formatTime.js';

dotenv.config();

// Detect category from class name
function getCategory(className) {
  if (!className) return 'other';
  const name = className.toLowerCase();

  // Check reformer BEFORE pilates (reformer is a type of pilates)
  if (name.includes('reformer')) return 'reformer';
  if (name.includes('pilates') || name.includes('mat work')) return 'pilates';

  // Yoga variations
  if (name.includes('yoga') || name.includes('vinyasa') || name.includes('yin') || name.includes('ashtanga') || name.includes('hatha') || name.includes('bikram')) return 'yoga';

  // Spin/Cycling
  if (name.includes('spin') || name.includes('cycle') || name.includes('ride') || name.includes('rpm')) return 'spin';

  // Boxing - check before HIIT (some boxing is high intensity)
  if (name.includes('box') || name.includes('fight') || name.includes('combat') || name.includes('rumble') || name.includes('punch') || name.includes('kick')) return 'boxing';

  // HIIT / Cardio
  if (name.includes('hiit') || name.includes('metcon') || name.includes('bootcamp') || name.includes('sweat') || name.includes('burn') || name.includes('inferno') || name.includes('blast') || name.includes('circuit') || name.includes('tabata') || name.includes('cardio')) return 'hiit';

  // Strength / Conditioning
  if (name.includes('strength') || name.includes('lift') || name.includes('pump') || name.includes('sculpt') || name.includes('reshape') || name.includes('tone') || name.includes('kettlebell') || name.includes('trx') || name.includes('weight') || name.includes('condition') || name.includes('build') || name.includes('warrior')) return 'strength';

  // Running
  if (name.includes('tread') || name.includes('run')) return 'run';

  // Barre
  if (name.includes('barre')) return 'barre';

  // Dance
  if (name.includes('dance') || name.includes('groove') || name.includes('zumba')) return 'dance';

  // Recovery / Stretch
  if (name.includes('stretch') || name.includes('recovery') || name.includes('restore') || name.includes('mobility') || name.includes('foam roll')) return 'recovery';

  // Swimming
  if (name.includes('swim')) return 'swimming';

  // Aerial
  if (name.includes('aerial') || name.includes('silk') || name.includes('trapeze')) return 'aerial';

  return 'other';
}

// ============================================================
// GYM_SLUG NORMALIZATION
// Converts generic brand slugs to location-specific slugs
// that match entries in the venues table
// ============================================================

// Location keyword → venue gym_slug mappings
const VIRGIN_ACTIVE_LOCATIONS = {
  'fulham pools': 'virgin-active-fulham-pools',
  'fulham': 'virgin-active-fulham-pools',
  'bromley': 'virgin-active-bromley',
  'wandsworth smugglers': 'virgin-active-wandsworth-smugglers-way',
  'smugglers way': 'virgin-active-wandsworth-smugglers-way',
  'smugglers': 'virgin-active-wandsworth-smugglers-way',
  'mill hill': 'virgin-active-mill-hill',
  'moorgate': 'virgin-active-moorgate',
  'strand': 'virgin-active-strand',
  'high street kensington': 'virgin-active-kensington',
  'kensington': 'virgin-active-kensington',
  'canary riverside': 'virgin-active-canary-riverside',
  'canary': 'virgin-active-canary-riverside',
  'aldersgate': 'virgin-active-aldersgate',
  'islington angel': 'virgin-active-islington-angel',
  'islington': 'virgin-active-islington-angel',
  'angel': 'virgin-active-islington-angel',
  'mayfair': 'virgin-active-mayfair',
  'chiswick riverside': 'virgin-active-chiswick-riverside',
  'chiswick park': 'virgin-active-chiswick-park',
  'chiswick': 'virgin-active-chiswick-park',
  'swiss cottage': 'virgin-active-swiss-cottage',
  'cannon street': 'virgin-active-cannon-street-walbrook',
  'walbrook': 'virgin-active-cannon-street-walbrook',
  'crouch end': 'virgin-active-crouch-end',
  'wimbledon worple': 'virgin-active-wimbledon-worple-road',
  'worple road': 'virgin-active-wimbledon-worple-road',
  'wimbledon': 'virgin-active-wimbledon-worple-road',
  'barbican': 'virgin-active-barbican',
  'notting hill': 'virgin-active-notting-hill',
  'northwood': 'virgin-active-northwood',
  'clapham': 'virgin-active-clapham',
  'piccadilly': 'virgin-active-piccadilly',
  'streatham': 'virgin-active-streatham',
  'balham': 'virgin-active-balham',
  'bank': 'virgin-active-bank',
  'highbury': 'virgin-active-highbury',
  'finchley': 'virgin-active-finchley',
  'wandsworth southside': 'virgin-active-wandsworth-southside',
  'southside': 'virgin-active-wandsworth-southside',
};

const REBEL_LOCATIONS = {
  'south bank': '1rebel-south-bank',
  'southbank': '1rebel-south-bank',
  'angel': '1rebel-angel',
  'high street kensington': '1rebel-high-street-kensington',
  'kensington': '1rebel-high-street-kensington',
  'broadgate': '1rebel-broadgate',
  'victoria': '1rebel-victoria',
  'euston': '1rebel-euston',
  'oxford circus': '1rebel-oxford-circus',
  'oxford': '1rebel-oxford-circus',
  'bayswater': '1rebel-bayswater',
  'holborn': '1rebel-holborn',
  'chelsea': '1rebel-chelsea',
  'st mary axe': '1rebel-st-mary-axe',
  'st mary': '1rebel-st-mary-axe',
  'st. mary': '1rebel-st-mary-axe',
  'leadenhall': '1rebel-leadenhall',
  'st johns wood': '1rebel-st-johns-wood',
  "st john's wood": '1rebel-st-johns-wood',
  'johns wood': '1rebel-st-johns-wood',
};

const FRAME_LOCATIONS = {
  'shoreditch': 'frame-shoreditch',
  'kings cross': 'frame-kings-cross',
  "king's cross": 'frame-kings-cross',
  'victoria': 'frame-victoria',
  'angel': 'frame-angel',
  'hammersmith': 'frame-hammersmith',
  'fitzrovia': 'frame-fitzrovia',
  'stratford': 'frame-stratford',
  'queen elizabeth': 'frame-stratford',
};

const PSYCLE_LOCATIONS = {
  'oxford': 'psycle-oxford-circus',
  'oxford circus': 'psycle-oxford-circus',
  'clapham': 'psycle-clapham',
  'shoreditch': 'psycle-shoreditch',
  'bank': 'psycle-bank',
  'notting hill': 'psycle-notting-hill',
  'victoria': 'psycle-victoria',
  'canary': 'psycle-canary-wharf',
  'canary wharf': 'psycle-canary-wharf',
  'westfield': 'psycle-westfield-stratford',
  'stratford': 'psycle-westfield-stratford',
};

const TRIBES_LOCATIONS = {
  'crouch end': '3tribes-crouch-end',
  'borough': '3tribes-borough',
};

const BARRYS_LOCATIONS = {
  'west': 'barrys-london-west',
  'london west': 'barrys-london-west',
  'east': 'barrys-london-east',
  'london east': 'barrys-london-east',
  'central': 'barrys-london-central',
  'london central': 'barrys-london-central',
};

/**
 * Normalize gym_slug to match venues table entries
 * @param {string} gymSlug - The incoming gym_slug (may be generic like 'virginactive')
 * @param {string} location - The location field from the class
 * @returns {string} - Normalized gym_slug that matches venues table
 */
function normalizeGymSlug(gymSlug, location) {
  if (!gymSlug) return gymSlug;
  
  const slug = gymSlug.toLowerCase();
  const loc = (location || '').toLowerCase();
  
  // Helper to find matching location
  // Sort by keyword length descending to match longer/more specific keywords first
  // e.g., 'chiswick riverside' should match before 'chiswick'
  const findLocation = (locationMap) => {
    const sortedEntries = Object.entries(locationMap)
      .sort((a, b) => b[0].length - a[0].length);
    
    for (const [keyword, venueSlug] of sortedEntries) {
      if (loc.includes(keyword)) {
        return venueSlug;
      }
    }
    return null;
  };
  
  // Check for generic Virgin Active slugs
  if (slug === 'virginactive' || slug === 'virgin-active') {
    const match = findLocation(VIRGIN_ACTIVE_LOCATIONS);
    if (match) return match;
    // If no match, keep original (will need venue added later)
    console.warn(`[Supabase] Unknown Virgin Active location: "${location}"`);
    return slug;
  }
  
  // Check for generic 1Rebel slugs
  if (slug === '1rebel') {
    const match = findLocation(REBEL_LOCATIONS);
    if (match) return match;
    console.warn(`[Supabase] Unknown 1Rebel location: "${location}"`);
    return slug;
  }
  
  // Check for generic Frame slugs
  if (slug === 'frame') {
    const match = findLocation(FRAME_LOCATIONS);
    if (match) return match;
    console.warn(`[Supabase] Unknown Frame location: "${location}"`);
    return slug;
  }
  
  // Check for generic Psycle slugs
  if (slug === 'psycle') {
    const match = findLocation(PSYCLE_LOCATIONS);
    if (match) return match;
    console.warn(`[Supabase] Unknown Psycle location: "${location}"`);
    return slug;
  }
  
  // Check for 3Tribes (also handles case sensitivity)
  if (slug === '3tribes' || slug === '3Tribes') {
    const match = findLocation(TRIBES_LOCATIONS);
    if (match) return match;
    return '3tribes-crouch-end'; // Default
  }
  
  // Check for generic Barry's slugs
  if (slug === 'barrys' || slug === "barry's") {
    const match = findLocation(BARRYS_LOCATIONS);
    if (match) return match;
    console.warn(`[Supabase] Unknown Barry's location: "${location}"`);
    return slug;
  }
  
  // Return original slug if not a known generic brand
  return slug;
}

// Extract brand from gym_slug - synced with venues table brand_slugs
function getBrandSlug(gymSlug) {
  if (!gymSlug) return gymSlug;
  const s = gymSlug.toLowerCase();

  // 1. Multi-word brand prefixes (check FIRST - prevents truncation)
  const multiWordPrefixes = [
    'virgin-active',
    'core-collective',
    'third-space',
    'another-space',
    'boom-cycle',
    'ten-health',
    'do-it-like-a-mother',
  ];

  for (const prefix of multiWordPrefixes) {
    if (s.startsWith(prefix + '-') || s === prefix) {
      return prefix;
    }
  }

  // 2. Normalize virginactive → virgin-active
  if (s === 'virginactive' || s.startsWith('virginactive-')) {
    return 'virgin-active';
  }

  // 3. Known multi-location brands - extract first segment
  const multiLocationBrands = [
    '1rebel', 'barrys', 'psycle', 'frame', '3tribes', 'mbo',
    'f45', 'blok', 'kobox', 'barrecore', 'heartcore', 'equinox',
    'gymbox', 'mad', '12x3', 'shiva-shakti'
  ];

  const firstSegment = s.split('-')[0];
  if (multiLocationBrands.includes(firstSegment)) {
    return firstSegment;
  }

  // 4. Single-location studios - keep full gym_slug as brand_slug
  return s;
}

// Multi-location brands that need "Brand - Location" format in display
const MULTI_LOCATION_BRANDS = new Set([
  'virgin-active', 'virginactive',
  '1rebel', 
  'frame',
  'psycle',
  'barrys', "barry's",
  '3tribes',
  'f45',
  'equinox',
  'blok',
  'kobox',
  'barrecore',
  'heartcore',
  'gymbox',
  'core-collective',
  'third-space',
  'another-space',
  'shiva-shakti',
]);

// Check if a brand has multiple locations
function isMultiLocationBrand(brandSlug) {
  if (!brandSlug) return false;
  const brand = brandSlug.toLowerCase();
  return MULTI_LOCATION_BRANDS.has(brand) || 
    MULTI_LOCATION_BRANDS.has(brand.split('-')[0]);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Key in .env file!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveToSupabase(classes) {
  if (!classes || classes.length === 0) return;

  console.log(`[Supabase] Processing ${classes.length} classes...`);

  // 1. Universal Formatting (Handles Old & New Scraper Formats)
  const formattedData = classes.map(c => {
    
    // ADAPTER LOGIC: Check for new key, fallback to old key
    const rawGym = c.gym_slug || c.gym || 'unknown';
    const finalDate = c.date || c.raw_date;
    const finalTime = formatTo24Hr(c.time || c.start_time);
    const finalTrainer = c.trainer || c.instructor || 'Instructor';
    const finalLocation = c.location || 'London';
    const finalName = c.class_name || 'Class';

    // Safety check: If time/date missing, we can't generate ID
    if (!finalTime || !finalDate) {
        console.warn(`[Supabase] Skipping invalid item (Missing Time/Date):`, c);
        return null;
    }

    // NORMALIZE gym_slug using location data
    // This converts generic slugs like 'virginactive' to location-specific
    // slugs like 'virgin-active-strand' that match the venues table
    const finalGym = normalizeGymSlug(rawGym, finalLocation);

    // Construct Unique ID
    // If source_id is provided (e.g., from BSport API), use it for stability
    // Otherwise fall back to generated ID (but avoid location which can change)
    let uniqueId;
    if (c.source_id) {
      uniqueId = c.source_id;
    } else {
      uniqueId = `${finalGym}-${finalDate}-${finalTime}-${finalName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    return {
      class_uid: uniqueId,
      gym_slug: finalGym,
      class_name: finalName,
      trainer: finalTrainer,
      location: finalLocation,
      date: finalDate,
      time: finalTime,
      status: c.status || 'Full',
      link: c.link || '',
      category: getCategory(finalName),
      brand_slug: getBrandSlug(finalGym),
      updated_at: new Date()
    };
  }).filter(Boolean); // Remove nulls

  // 2. Deduplicate based on class_uid
  const uniqueDataMap = new Map();
  formattedData.forEach(item => {
    if (item) uniqueDataMap.set(item.class_uid, item);
  });
  const uniqueData = Array.from(uniqueDataMap.values());

  if (uniqueData.length === 0) {
      console.log("[Supabase] No valid classes to upload after filtering.");
      return;
  }

  // 3. Upsert clean data
  const { error } = await supabase
    .from('classes')
    .upsert(uniqueData, { onConflict: 'class_uid' });

  if (error) {
    console.error('[Supabase] Error uploading:', error.message);
    // Log sample to see what went wrong
    console.log('[Supabase] Failed Payload Sample:', uniqueData[0]);
  } else {
    console.log(`[Supabase] Success! ${uniqueData.length} classes synced.`);
  }
}