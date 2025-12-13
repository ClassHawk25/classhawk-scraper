#!/usr/bin/env node
/**
 * Quick script to check MindBody scraper status
 * Run: node scripts/check-mindbody.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkMindBody() {
  console.log('🔍 Checking MindBody scraper status...\n');

  // 1. Check for classes with gym_slug starting with 'mb-'
  const { data: mbClasses, error: mbError } = await supabase
    .from('classes')
    .select('gym_slug, class_name, date, time')
    .like('gym_slug', 'mb-%')
    .gte('date', new Date().toISOString().split('T')[0])
    .limit(100);

  if (mbError) {
    console.error('Error querying:', mbError.message);
    return;
  }

  console.log(`📊 MindBody classes (gym_slug LIKE 'mb-%'): ${mbClasses?.length || 0}`);

  if (mbClasses && mbClasses.length > 0) {
    // Group by gym_slug
    const byGym = {};
    mbClasses.forEach(c => {
      byGym[c.gym_slug] = (byGym[c.gym_slug] || 0) + 1;
    });

    console.log('\n📍 MindBody studios found:');
    Object.entries(byGym)
      .sort((a, b) => b[1] - a[1])
      .forEach(([gym, count]) => {
        console.log(`   ${gym}: ${count} classes`);
      });
  }

  // 2. Also check if there are any classes with 'mindbody' in class_uid (just in case)
  const { data: altClasses, error: altError } = await supabase
    .from('classes')
    .select('class_uid, gym_slug')
    .ilike('class_uid', '%mindbody%')
    .limit(10);

  if (altClasses && altClasses.length > 0) {
    console.log('\n⚠️  Also found classes with "mindbody" in class_uid:');
    altClasses.forEach(c => console.log(`   ${c.class_uid}`));
  }

  // 3. Summary
  console.log('\n' + '='.repeat(50));
  if ((mbClasses?.length || 0) === 0) {
    console.log('❌ NO MindBody classes found in database');
    console.log('\nPossible reasons:');
    console.log('1. MindBody API not available in UK (most likely)');
    console.log('2. Scraper has never been run successfully');
    console.log('3. Rate limited by MindBody API');
    console.log('\n💡 Recommendation: Disable MindBody scraper to save time');
  } else {
    console.log(`✅ MindBody scraper IS working - ${mbClasses.length}+ classes found`);
  }
}

checkMindBody().catch(console.error);

