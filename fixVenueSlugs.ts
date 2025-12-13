import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Gyms that have multiple real locations (not just internal studio rooms)
const MULTI_LOCATION_GYMS = [
  'virginactive',
  '1rebel',
  'barrys',
  'psycle',
  'frame',
  '3Tribes',
  'pilates-circuit',
  'lift-studio-ldn',
  'mad-lagree',
  'mbo-train-yard',
  'fold-at-home',
  '24n-fitness',
  '1sculpt-fitness-reigate-studio',
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')           // Remove apostrophes
    .replace(/[^a-z0-9\s-]/g, '')   // Remove special chars
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

async function fixVenueSlugs() {
  console.log('🔧 Starting venue slug fix...\n');

  for (const gymSlug of MULTI_LOCATION_GYMS) {
    console.log(`\n📍 Processing: ${gymSlug}`);
    
    // Get all venues with this gym_slug
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('id, gym_slug, name, latitude, longitude')
      .eq('gym_slug', gymSlug);

    if (venueError) {
      console.error(`  ❌ Error fetching venues: ${venueError.message}`);
      continue;
    }

    if (!venues || venues.length <= 1) {
      console.log(`  ⏭️ Skipping - only ${venues?.length || 0} venue(s)`);
      continue;
    }

    console.log(`  Found ${venues.length} locations`);

    for (const venue of venues) {
      const newSlug = generateSlug(venue.name);
      
      if (newSlug === gymSlug) {
        console.log(`  ⏭️ ${venue.name}: slug unchanged (${newSlug})`);
        continue;
      }

      console.log(`  🔄 ${venue.name}`);
      console.log(`     Old slug: ${venue.gym_slug}`);
      console.log(`     New slug: ${newSlug}`);

      // Update venue
      const { error: updateVenueError } = await supabase
        .from('venues')
        .update({ gym_slug: newSlug })
        .eq('id', venue.id);

      if (updateVenueError) {
        console.log(`     ❌ Venue update failed: ${updateVenueError.message}`);
        continue;
      }
      console.log(`     ✅ Venue updated`);

      // Find and update matching classes
      // Match by old gym_slug AND location containing part of venue name
      const venueName = venue.name;
      
      // Extract location identifier from venue name
      // e.g., "Virgin Active Moorgate" -> search for "Moorgate" in classes.location
      const nameParts = venueName.split(' ');
      const locationKeyword = nameParts[nameParts.length - 1]; // Last word usually is location
      
      // Also try the last two words for places like "Canary Riverside"
      const lastTwoWords = nameParts.slice(-2).join(' ');

      // Count matching classes first
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('gym_slug', gymSlug)
        .or(`location.ilike.%${locationKeyword}%,location.ilike.%${lastTwoWords}%`);

      console.log(`     📚 Found ${classCount || 0} classes to update`);

      if (classCount && classCount > 0) {
        // Update classes
        const { error: updateClassError } = await supabase
          .from('classes')
          .update({ gym_slug: newSlug })
          .eq('gym_slug', gymSlug)
          .or(`location.ilike.%${locationKeyword}%,location.ilike.%${lastTwoWords}%`);

        if (updateClassError) {
          console.log(`     ❌ Class update failed: ${updateClassError.message}`);
        } else {
          console.log(`     ✅ Classes updated`);
        }
      }
    }
  }

  console.log('\n\n✅ Venue slug fix complete!');
  
  // Verify results
  console.log('\n📊 Verification - checking for remaining duplicates:');
  const { data: remaining } = await supabase
    .from('venues')
    .select('gym_slug')
    .in('gym_slug', MULTI_LOCATION_GYMS);

  const counts: Record<string, number> = {};
  remaining?.forEach(v => {
    counts[v.gym_slug] = (counts[v.gym_slug] || 0) + 1;
  });

  const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️ Still has duplicates:', duplicates);
  } else {
    console.log('✅ No duplicates remaining for target gyms');
  }
}

// Run
fixVenueSlugs().catch(console.error);