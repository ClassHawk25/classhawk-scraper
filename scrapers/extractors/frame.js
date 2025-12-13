// scrapers/extractors/frame.js
// Frame London - MarianaTek API Scraper

const MARIANATEK_API = 'https://frame.marianatek.com/api/customer/v1';
const REGION_ID = '48541';

// Frame London locations (from API discovery)
const FRAME_LOCATIONS = [
  { id: '48719', name: 'Kings Cross' },
  { id: '48720', name: 'Shoreditch' },
  { id: '48718', name: 'Hammersmith' },
  { id: '48717', name: 'Angel' },
  { id: '48721', name: 'Victoria' }
];

async function scrapeFrame(browser, config) {
  // Note: browser param kept for compatibility with engine.js but not used
  // This is a pure API scraper - no Puppeteer needed

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const minDate = today.toISOString().split('T')[0];
  const maxDate = endDate.toISOString().split('T')[0];

  console.log(`[Frame] Fetching classes from ${minDate} to ${maxDate}...`);

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
        console.log(`[Frame] API error: ${res.status}`);
        break;
      }

      const data = await res.json();
      const results = data.results || [];
      allResults = allResults.concat(results);

      // Check if there are more pages
      hasMore = data.next !== null;
      page++;

      if (page > 10) break; // Safety limit
    }

    // Filter out online classes
    const londonClasses = allResults.filter(cls => {
      const locName = cls.location?.name?.toLowerCase() || '';
      return !locName.includes('online');
    });

    const allClasses = londonClasses.map(cls => {
      const startTime = new Date(cls.start_datetime);
      const dateStr = startTime.toISOString().split('T')[0];
      // Convert to local UK time (UTC in winter, BST in summer)
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

      const locationName = cls.location?.name || 'Frame';

      return {
        gym_slug: 'frame',
        class_name: cls.class_type?.name || 'Frame Class',
        trainer: cls.instructors?.[0]?.name || 'Instructor',
        location: `Frame ${locationName}`,
        date: dateStr,
        time: timeStr,
        status: status,
        link: `https://www.moveyourframe.com/timetable/`,
        source_id: `marianatek-frame-${cls.id}`
      };
    });

    console.log(`[Frame] ✓ ${allClasses.length} classes from ${FRAME_LOCATIONS.length} locations`);
    return allClasses;

  } catch (error) {
    console.error(`[Frame] Error fetching API: ${error.message}`);
    return [];
  }
}

export default scrapeFrame;
