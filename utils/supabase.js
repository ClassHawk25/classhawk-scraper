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
    const finalGym = c.gym_slug || c.gym || 'unknown';
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