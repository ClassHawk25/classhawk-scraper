// scrapers/extractors/mindbody.js
const MINDBODY_API = 'https://prod-mkt-gateway.mindbody.io/v1';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://www.mindbodyonline.com',
  'Referer': 'https://www.mindbodyonline.com/'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createGymSlug(studioName) {
  return 'mb-' + studioName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

function formatDate(dateString) {
  return new Date(dateString).toISOString().split('T')[0];
}

function formatTime(dateString) {
  const d = new Date(dateString);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

async function discoverStudios(lat, lng, radius, maxResults) {
  const studios = [];
  let page = 1;

  while (studios.length < maxResults) {
    const payload = {
      sort: '-_score,distance',
      page: { size: 50, number: page },
      filter: {
        categories: [],
        radius: radius,
        term: '',
        cmMembershipBookable: 'any',
        latitude: lat,
        longitude: lng,
        categoryTypes: ['Fitness', 'Gyms', 'Yoga', 'Pilates', 'Cycling', 'HIIT', 'Barre', 'CrossFit', 'Boxing', 'Martial Arts', 'Dance']
      }
    };

    try {
      const response = await fetch(`${MINDBODY_API}/search/locations`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('      ⏳ Rate limited, waiting 30s...');
          await delay(30000);
          continue;
        }
        break;
      }

      const data = await response.json();
      const results = (data.data || []).map(item => ({
        id: item.id,
        ...item.attributes
      }));
      if (results.length === 0) break;

      studios.push(...results);
      if (studios.length >= (data.meta?.total || 0)) break;

      page++;
      await delay(1000);
    } catch (error) {
      console.error(`      ❌ Discovery error: ${error.message}`);
      break;
    }
  }

  return studios.slice(0, maxResults);
}

async function getStudioClasses(studioId, studioName, gymSlug) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);

  const startStr = today.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const endpoints = [
    `${MINDBODY_API}/locations/${studioId}/classes?startDate=${startStr}&endDate=${endStr}`,
    `${MINDBODY_API}/locations/${studioId}/schedule?startDate=${startStr}&endDate=${endStr}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) continue;

      const data = await response.json();
      const rawClasses = data.data || data.classes || data.items || [];

      if (rawClasses.length > 0) {
        return rawClasses.map(cls => {
          const startDateTime = cls.startDateTime || cls.startTime || cls.start_time;
          if (!startDateTime) return null;

          return {
            gym_slug: gymSlug,
            class_name: cls.name || cls.className || 'Class',
            trainer: cls.instructorName || cls.instructor?.name || 'Instructor',
            location: cls.locationName || cls.location?.name || studioName,
            date: formatDate(startDateTime),
            time: formatTime(startDateTime),
            status: (cls.availableCapacity ?? 1) > 0 ? 'Open' : 'Full',
            link: cls.bookingUrl || `https://www.mindbodyonline.com/explore/locations/${studioId}`,
            spots_available: cls.availableCapacity ?? null,
            spots_total: cls.maxCapacity || cls.classSize || null
          };
        }).filter(Boolean);
      }
    } catch (error) {
      continue;
    }
  }

  return [];
}

async function scrapeMindBody(browser, config) {
  console.log('   [MindBody] Starting API-based discovery...');

  const allClasses = [];
  const processedStudios = new Set();

  for (const zone of config.zones) {
    console.log(`   [MindBody] 📍 Scanning ${zone.name}...`);

    try {
      const studios = await discoverStudios(zone.lat, zone.lng, zone.radius || 3, zone.maxStudios || 30);
      const newStudios = studios.filter(s => !processedStudios.has(s.id));

      console.log(`   [MindBody]    Found ${newStudios.length} new studios`);

      for (const studio of newStudios) {
        processedStudios.add(studio.id);
        await delay(600);

        const classes = await getStudioClasses(studio.id, studio.name, createGymSlug(studio.name));

        if (classes.length > 0) {
          console.log(`   [MindBody]    ✓ ${studio.name}: ${classes.length} classes`);
          allClasses.push(...classes);
        }
      }
    } catch (error) {
      console.error(`   [MindBody] ❌ Zone failed: ${error.message}`);
    }

    await delay(1000);
  }

  console.log(`   [MindBody] ✅ Complete: ${allClasses.length} classes from ${processedStudios.size} studios`);
  return allClasses;
}

export default scrapeMindBody;
