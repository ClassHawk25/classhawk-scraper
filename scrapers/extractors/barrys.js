// scrapers/extractors/barrys.js
// Barry's London - MarianaTek API Scraper (converted from Puppeteer)

const MARIANATEK_API = 'https://barrysbootcamp.marianatek.com/api/customer/v1';
const REGION_ID = '9790'; // London

// Barry's London locations (from API discovery)
const BARRYS_LOCATIONS = [
  { id: '9832', name: 'London Central' },
  { id: '9840', name: 'London Soho' },
  { id: '9837', name: 'London Canary Wharf' },
  { id: '9833', name: "London St Paul's" },
  { id: '9836', name: 'London SW1' },
  { id: '9834', name: 'London East' },
  { id: '9835', name: 'London West' }
];

async function scrapeBarrys(browser, config) {
  // Note: browser param kept for compatibility with engine.js but not used
  // This is a pure API scraper - no Puppeteer needed

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const minDate = today.toISOString().split('T')[0];
  const maxDate = endDate.toISOString().split('T')[0];

  console.log(`[Barry's] Fetching classes from ${minDate} to ${maxDate}...`);

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
        console.log(`[Barry's] API error: ${res.status}`);
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

      const rawLocationName = cls.location?.name || 'London';
      const locationName = rawLocationName.startsWith("Barry")
        ? rawLocationName
        : `Barry's ${rawLocationName}`;

      return {
        gym_slug: (() => {
          const slug = locationName.toLowerCase().replace(/[']/g, '').replace(/\s+/g, '-');
          // Remove leading "barrys-" if already present to avoid double prefix
          return slug.startsWith('barrys-') ? slug : `barrys-${slug}`;
        })(),
        class_name: cls.class_type?.name || "Barry's Class",
        trainer: cls.instructors?.[0]?.name || 'Instructor',
        location: locationName,
        date: dateStr,
        time: timeStr,
        status: status,
        link: 'https://www.barrys.com/book-now/',
        source_id: `marianatek-barrys-${cls.id}`
      };
    });

    console.log(`[Barry's] ✓ ${allClasses.length} classes from ${BARRYS_LOCATIONS.length} locations`);
    return allClasses;

  } catch (error) {
    console.error(`[Barry's] Error fetching API: ${error.message}`);
    return [];
  }
}

export default scrapeBarrys;
