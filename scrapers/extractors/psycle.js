// scrapers/extractors/psycle.js
// Psycle London - CodexFit API Scraper (converted from Puppeteer)

const CODEXFIT_API = 'https://psycle.codexfit.com/api/v1/customer';

// Psycle London locations (from API discovery)
const PSYCLE_LOCATIONS = [
  { id: 1, name: 'Oxford Circus' },
  { id: 4, name: 'Shoreditch' },
  { id: 8, name: 'Clapham' },
  { id: 10, name: 'Notting Hill' },
  { id: 15, name: 'Victoria' },
  { id: 17, name: 'Bank' }
];

async function scrapePsycle(browser, config) {
  // Note: browser param kept for compatibility with engine.js but not used
  // This is a pure API scraper - no Puppeteer needed

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const fromDate = today.toISOString().split('T')[0];
  const toDate = endDate.toISOString().split('T')[0];

  console.log(`[Psycle] Fetching classes from ${fromDate} to ${toDate}...`);

  try {
    const url = `${CODEXFIT_API}/events?from=${fromDate}&to=${toDate}&include=event_type,instructor,studio,location`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.log(`[Psycle] API error: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const events = json.data || [];
    const relations = json.relations || {};

    // Build lookup maps from relations
    const locations = {};
    const instructors = {};
    const eventTypes = {};
    const studios = {};

    (relations.locations || []).forEach(l => locations[l.id] = l.name);
    (relations.instructors || []).forEach(i => instructors[i.id] = i.full_name || i.first_name || 'Instructor');
    (relations.event_types || []).forEach(e => eventTypes[e.id] = e.name);
    (relations.studios || []).forEach(s => studios[s.id] = s);

    // Filter out non-visible events and map to class format
    const allClasses = events
      .filter(evt => evt.is_visible !== false)
      .map(evt => {
        const startTime = new Date(evt.start_at);
        const dateStr = startTime.toISOString().split('T')[0];
        const timeStr = startTime.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/London'
        });

        // Get location from studio -> location_id
        const studio = studios[evt.studio_id];
        const locationName = studio ? (locations[studio.location_id] || 'Psycle') : 'Psycle';

        const instructorName = instructors[evt.instructor_id] || 'Instructor';
        const className = eventTypes[evt.event_type_id] || 'Psycle Class';

        // Determine status based on API fields
        let status = 'Open';
        if (evt.is_fully_booked || evt.occupancy >= evt.capacity) {
          status = evt.is_waitlistable ? 'Waitlist' : 'Full';
        }

        // Skip "At Home" / online classes
        if (locationName.toLowerCase().includes('at home') || locationName.toLowerCase().includes('online')) {
          return null;
        }

        return {
          gym_slug: 'psycle',
          class_name: className,
          trainer: instructorName,
          location: locationName.startsWith('Psycle') ? locationName : `Psycle ${locationName}`,
          date: dateStr,
          time: timeStr,
          status: status,
          link: 'https://psyclelondon.com/pages/book',
          source_id: `codexfit-psycle-${evt.id}`
        };
      })
      .filter(Boolean); // Remove nulls (online classes)

    console.log(`[Psycle] ✓ ${allClasses.length} classes from ${PSYCLE_LOCATIONS.length} locations`);
    return allClasses;

  } catch (error) {
    console.error(`[Psycle] Error: ${error.message}`);
    return [];
  }
}

export default scrapePsycle;
