import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PlaceDetails {
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: {
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }[];
}

// Step 1: Find the Google Place ID for a venue
async function findPlaceId(name: string, lat: number, lon: number): Promise<string | null> {
  try {
    // Use Text Search with location bias
    const query = encodeURIComponent(`${name} gym fitness London`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${lat},${lon}&radius=1000&key=${GOOGLE_MAPS_API_KEY}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === 'OK' && data.results?.length > 0) {
      // Return the first result's place_id
      return data.results[0].place_id;
    }
    
    // Fallback: try Nearby Search
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=200&keyword=${encodeURIComponent(name)}&type=gym&key=${GOOGLE_MAPS_API_KEY}`;
    const nearbyRes = await fetch(nearbyUrl);
    const nearbyData = await nearbyRes.json();
    
    if (nearbyData.status === 'OK' && nearbyData.results?.length > 0) {
      return nearbyData.results[0].place_id;
    }
    
    return null;
  } catch (err) {
    console.error(`Error finding place ID for ${name}:`, err);
    return null;
  }
}

// Step 2: Get Place Details including reviews
async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const fields = 'place_id,rating,user_ratings_total,reviews';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === 'OK' && data.result) {
      return {
        place_id: data.result.place_id,
        rating: data.result.rating,
        user_ratings_total: data.result.user_ratings_total,
        reviews: data.result.reviews?.slice(0, 5) // Keep top 5 reviews
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error getting place details for ${placeId}:`, err);
    return null;
  }
}

// Step 3: Update venue in database
async function updateVenueReviews(
  venueId: string, 
  placeId: string,
  rating: number | null,
  reviewCount: number | null,
  reviews: any[] | null
): Promise<boolean> {
  const { error } = await supabase
    .from('venues')
    .update({
      google_place_id: placeId,
      google_rating: rating,
      google_review_count: reviewCount,
      google_reviews: reviews,
      reviews_updated_at: new Date().toISOString()
    })
    .eq('id', venueId);
  
  return !error;
}

async function main() {
  console.log('⭐ Google Reviews Fetcher\n');
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ Missing GOOGLE_MAPS_API_KEY');
    process.exit(1);
  }
  
  // Get all venues that need reviews (no google_place_id yet, or reviews older than 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, gym_slug, name, latitude, longitude, google_place_id, reviews_updated_at')
    .not('latitude', 'is', null)
    .or(`google_place_id.is.null,reviews_updated_at.lt.${thirtyDaysAgo.toISOString()}`)
    .order('name');
  
  if (error) {
    console.error('❌ Error fetching venues:', error);
    process.exit(1);
  }
  
  console.log(`Found ${venues?.length || 0} venues to process\n`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < (venues?.length || 0); i++) {
    const venue = venues![i];
    console.log(`[${i + 1}/${venues!.length}] ${venue.name}`);
    
    // Skip if no coordinates
    if (!venue.latitude || !venue.longitude) {
      console.log('   ⚠️ Skipped: No coordinates');
      skipped++;
      continue;
    }
    
    // Get or find place_id
    let placeId = venue.google_place_id;
    
    if (!placeId) {
      placeId = await findPlaceId(venue.name, venue.latitude, venue.longitude);
      await sleep(200); // Rate limit
      
      if (!placeId) {
        console.log('   ❌ Could not find Google Place');
        failed++;
        continue;
      }
    }
    
    // Get place details
    const details = await getPlaceDetails(placeId);
    await sleep(200); // Rate limit
    
    if (!details) {
      console.log('   ❌ Could not get place details');
      failed++;
      continue;
    }
    
    // Update database
    const updated = await updateVenueReviews(
      venue.id,
      placeId,
      details.rating || null,
      details.user_ratings_total || null,
      details.reviews || null
    );
    
    if (updated) {
      const rating = details.rating ? `${details.rating}⭐ (${details.user_ratings_total} reviews)` : 'No rating';
      console.log(`   ✅ ${rating}`);
      success++;
    } else {
      console.log('   ❌ Database update failed');
      failed++;
    }
    
    await sleep(100);
  }
  
  console.log('\n' + '='.repeat(40));
  console.log('📊 SUMMARY');
  console.log('='.repeat(40));
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed:  ${failed}`);
  console.log(`   ⚠️ Skipped: ${skipped}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);