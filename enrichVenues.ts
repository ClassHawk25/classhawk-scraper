import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

interface PlaceDetails {
  description?: string;
  website?: string;
  phone?: string;
  photos?: { url: string; attribution: string }[];
  opening_hours?: { weekday_text: string[] };
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const fields = [
    'editorial_summary',
    'website',
    'formatted_phone_number',
    'photos',
    'opening_hours',
    'types'
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      console.log(`    ⚠️ No details found: ${data.status}`);
      return null;
    }

    const result = data.result;

    // Build photo URLs (first 5 photos)
    const photos = result.photos?.slice(0, 5).map((photo: any) => ({
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`,
      attribution: photo.html_attributions?.[0] || ''
    })) || [];

    return {
      description: result.editorial_summary?.overview || null,
      website: result.website || null,
      phone: result.formatted_phone_number || null,
      photos: photos.length > 0 ? photos : null,
      opening_hours: result.opening_hours?.weekday_text 
        ? { weekday_text: result.opening_hours.weekday_text }
        : null
    };
  } catch (error) {
    console.error(`    ❌ Error fetching place details:`, error);
    return null;
  }
}

async function enrichVenues() {
  console.log('🔧 Starting venue enrichment...\n');

  // Get venues that have google_place_id but missing description
  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, gym_slug, name, google_place_id, description')
    .not('google_place_id', 'is', null)
    .is('description', null)
    .limit(100); // Process in batches to avoid API limits

  if (error) {
    console.error('❌ Error fetching venues:', error);
    return;
  }

  console.log(`📍 Found ${venues?.length || 0} venues to enrich\n`);

  if (!venues || venues.length === 0) {
    console.log('✅ All venues already enriched!');
    return;
  }

  let enrichedCount = 0;
  let failedCount = 0;

  for (const venue of venues) {
    console.log(`\n📍 ${venue.name} (${venue.gym_slug})`);
    
    if (!venue.google_place_id) {
      console.log('    ⏭️ No google_place_id, skipping');
      continue;
    }

    const details = await getPlaceDetails(venue.google_place_id);

    if (!details) {
      failedCount++;
      continue;
    }

    // Update venue with enriched data
    const updateData: any = {};
    if (details.description) updateData.description = details.description;
    if (details.website) updateData.website = details.website;
    if (details.phone) updateData.phone = details.phone;
    if (details.photos) updateData.photos = details.photos;
    if (details.opening_hours) updateData.opening_hours = details.opening_hours;

    if (Object.keys(updateData).length === 0) {
      console.log('    ⚠️ No new data to update');
      continue;
    }

    const { error: updateError } = await supabase
      .from('venues')
      .update(updateData)
      .eq('id', venue.id);

    if (updateError) {
      console.log(`    ❌ Update failed: ${updateError.message}`);
      failedCount++;
    } else {
      console.log(`    ✅ Enriched with: ${Object.keys(updateData).join(', ')}`);
      enrichedCount++;
    }

    // Rate limit: 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n📊 Summary:');
  console.log(`✅ Enriched: ${enrichedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`⏭️ Skipped: ${(venues?.length || 0) - enrichedCount - failedCount}`);
}

// Also create a function to get place_id for venues that don't have one
async function findMissingPlaceIds() {
  console.log('\n🔍 Finding missing Place IDs...\n');

  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, gym_slug, name, latitude, longitude, google_place_id')
    .is('google_place_id', null)
    .not('latitude', 'is', null)
    .limit(50);

  if (error || !venues || venues.length === 0) {
    console.log('No venues need Place IDs');
    return;
  }

  console.log(`Found ${venues.length} venues without Place ID\n`);

  for (const venue of venues) {
    console.log(`📍 ${venue.name}`);

    // Use Text Search to find the place
    const query = encodeURIComponent(venue.name);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${venue.latitude},${venue.longitude}&radius=1000&key=${GOOGLE_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.[0]) {
        const placeId = data.results[0].place_id;
        
        const { error: updateError } = await supabase
          .from('venues')
          .update({ google_place_id: placeId })
          .eq('id', venue.id);

        if (!updateError) {
          console.log(`    ✅ Found Place ID: ${placeId.substring(0, 20)}...`);
        }
      } else {
        console.log(`    ⚠️ Not found`);
      }
    } catch (err) {
      console.log(`    ❌ Error: ${err}`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Run both
async function main() {
  // First, find missing place IDs
  await findMissingPlaceIds();
  
  // Then enrich venues with details
  await enrichVenues();
}

main().catch(console.error);