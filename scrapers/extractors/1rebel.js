// scrapers/extractors/1rebel.js
// 1Rebel London - MarianaTek API Scraper (converted from Puppeteer)

const MARIANATEK_API = 'https://1rebel.marianatek.com/api/customer/v1';
const REGION_ID = '48541'; // United Kingdom

// 1Rebel UK locations (from API discovery)
const REBEL_LOCATIONS = [
  { id: '48720', name: 'ANGEL' },
  { id: '48724', name: 'BAYSWATER' },
  { id: '48721', name: 'BROADGATE' },
  { id: '48728', name: 'HIGH STREET KENSINGTON' },
  { id: '48719', name: 'HOLBORN' },
  { id: '48726', name: 'OXFORD CIRCUS' },
  { id: '48729', name: 'EUSTON' },
  { id: '48723', name: 'SOUTH BANK' },
  { id: '48727', name: 'ST JOHNS WOOD' },
  { id: '48722', name: 'ST MARY AXE' },
  { id: '48725', name: 'VICTORIA' },
  { id: '48764', name: 'LEADENHALL' },
  { id: '48762', name: 'CHELSEA' }
];

// Helper to title case location names
function titleCase(str) {
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

async function scrape1Rebel(browser, config) {
  // Note: browser param kept for compatibility with engine.js but not used
  // This is a pure API scraper - no Puppeteer needed

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const minDate = today.toISOString().split('T')[0];
  const maxDate = endDate.toISOString().split('T')[0];

  console.log(`[1Rebel] Fetching classes from ${minDate} to ${maxDate}...`);

  // Paginate through all results
  let allResults = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = `${MARIANATEK_API}/classes?min_start_date=${minDate}&max_start_date=${maxDate}&region=${REGION_ID}&page_size=500&page=${page}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        console.log(`[1Rebel] API error: ${res.status}`);
        break;
      }

      const data = await res.json();
      const results = data.results || [];
      allResults = allResults.concat(results);

      // Check if there are more pages
      hasMore = data.next !== null;
      page++;

      if (page > 20) break; // Safety limit (1Rebel has lots of classes)
    }

    const classes = allResults;

    const allClasses = classes.map(cls => {
      const startTime = new Date(cls.start_datetime);
      const dateStr = startTime.toISOString().split('T')[0];
      // Convert to local UK time
      const timeStr = startTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London'
      });

      let status = 'Open';
      if (cls.available_spot_count === 0) {
        status = cls.waitlist_available ? 'Waitlist' : 'Full';
      }

      // Convert UPPERCASE location to Title Case
      const rawLocation = cls.location?.name || '1Rebel';
      const locationName = `1Rebel ${titleCase(rawLocation)}`;

      return {
        gym_slug: '1rebel',
        class_name: cls.class_type?.name || '1Rebel Class',
        trainer: cls.instructors?.[0]?.name || 'Instructor',
        location: locationName,
        date: dateStr,
        time: timeStr,
        status: status,
        link: 'https://www.1rebel.com/en-gb/reserve',
        source_id: `marianatek-1rebel-${cls.id}`
      };
    });

    console.log(`[1Rebel] ✓ ${allClasses.length} classes from ${REBEL_LOCATIONS.length} locations`);
    return allClasses;

  } catch (error) {
    console.error(`[1Rebel] Error fetching API: ${error.message}`);
    return [];
  }
}

export default scrape1Rebel;
