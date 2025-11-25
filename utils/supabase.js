// utils/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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
    const finalTime = c.time || c.start_time;
    const finalTrainer = c.trainer || c.instructor || 'Instructor';
    const finalLocation = c.location || 'London';
    const finalName = c.class_name || 'Class';

    // Safety check: If time/date missing, we can't generate ID
    if (!finalTime || !finalDate) {
        console.warn(`[Supabase] Skipping invalid item (Missing Time/Date):`, c);
        return null;
    }

    // Construct Unique ID
    const uniqueId = `${finalGym}-${finalDate}-${finalTime}-${finalLocation}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

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