import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BAD_COORDINATES = [
  { lat: 51.50740000, lon: -0.12780000 },
  { lat: 51.47500000, lon: -0.14800000 },
  { lat: 51.48750000, lon: -0.16870000 },
  { lat: 51.51200000, lon: -0.22000000 },
  { lat: 51.53900000, lon: -0.14260000 },
];

async function geocodeVenue(name: string, slug: string): Promise<{ lat: number; lon: number } | null> {
  const queries = [
    `${name} gym London UK`,
    `${name} fitness London UK`,
    `${slug.split('-').join(' ')} London UK`,
  ];

  for (const query of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:GB`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        if (loc.lat > 51.2 && loc.lat < 51.8 && loc.lng > -0.6 && loc.lng < 0.4) {
          return { lat: loc.lat, lon: loc.lng };
        }
      }
    } catch (err) {
      console.error(`Error geocoding "${query}":`, err);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

async function main() {
  console.log('🗺️  Venue Geocoding Script\n');

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ Missing GOOGLE_MAPS_API_KEY in .env');
    process.exit(1);
  }

  // Get venues with bad coordinates
  const allVenues: any[] = [];
  for (const coord of BAD_COORDINATES) {
    const { data } = await supabase
      .from('venues')
      .select('id, gym_slug, name')
      .gte('latitude', coord.lat - 0.0001)
      .lte('latitude', coord.lat + 0.0001)
      .gte('longitude', coord.lon - 0.0001)
      .lte('longitude', coord.lon + 0.0001);
    if (data) allVenues.push(...data);
  }

  const venues = Array.from(new Map(allVenues.map(v => [v.id, v])).values());
  console.log(`Found ${venues.length} venues to fix\n`);

  let fixed = 0, failed = 0;

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    console.log(`[${i + 1}/${venues.length}] ${v.name}`);

    const coords = await geocodeVenue(v.name, v.gym_slug);

    if (coords) {
      const isBad = BAD_COORDINATES.some(b => 
        Math.abs(coords.lat - b.lat) < 0.001 && Math.abs(coords.lon - b.lon) < 0.001
      );

      if (isBad) {
        console.log(`   ⚠️  Skipped (same bad coords)`);
        failed++;
        continue;
      }

      const { error } = await supabase
        .from('venues')
        .update({ latitude: coords.lat, longitude: coords.lon })
        .eq('id', v.id);

      if (!error) {
        console.log(`   ✅ ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
        fixed++;
      } else {
        console.log(`   ❌ DB error`);
        failed++;
      }
    } else {
      console.log(`   ❌ Could not geocode`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Fixed: ${fixed} | ❌ Failed: ${failed}`);
}

main().catch(console.error);