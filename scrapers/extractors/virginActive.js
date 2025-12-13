// scrapers/extractors/virginActive.js
// Virgin Active UK - API Scraper (converted from Puppeteer)

const VIRGIN_ACTIVE_API = 'https://www.virginactive.co.uk/api/club';

// Virgin Active UK clubs (from GetClubDetails API)
// Filtering to London & surrounding area clubs
const LONDON_CLUBS = [
  { id: 76, name: 'Aldersgate', slug: 'aldersgate' },
  { id: 29, name: 'Bank', slug: 'bank' },
  { id: 34, name: 'Bromley', slug: 'bromley' },
  { id: 35, name: 'Canary Riverside', slug: 'canary-riverside' },
  { id: 953, name: 'Cannon Street (Walbrook)', slug: 'cannon-street' },
  { id: 421, name: 'Chiswick Park', slug: 'chiswick-park' },
  { id: 405, name: 'Chiswick Riverside', slug: 'chiswick-riverside' },
  { id: 38, name: 'Clapham', slug: 'clapham' },
  { id: 39, name: 'Crouch End', slug: 'crouch-end' },
  { id: 47, name: 'Fulham Pools', slug: 'fulham-pools' },
  { id: 12, name: 'Islington Angel', slug: 'islington-angel' },
  { id: 51, name: 'Kensington', slug: 'kensington' },
  { id: 56, name: 'Mayfair', slug: 'mayfair' },
  { id: 57, name: 'Mill Hill', slug: 'mill-hill' },
  { id: 59, name: 'Moorgate', slug: 'moorgate' },
  { id: 60, name: 'Notting Hill', slug: 'notting-hill' },
  { id: 68, name: 'Strand', slug: 'strand' },
  { id: 69, name: 'Streatham', slug: 'streatham' },
  { id: 410, name: 'Swiss Cottage', slug: 'swiss-cottage' },
  { id: 425, name: 'Wandsworth Smugglers Way', slug: 'wandsworth-smugglers-way' },
  { id: 408, name: 'Wimbledon Worple Road', slug: 'wimbledon-worple-road' }
];

// Helper to clean up class titles
function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

async function scrapeVirginActive(browser, config) {
  // Note: browser param kept for compatibility with engine.js but not used
  // This is a pure API scraper - no Puppeteer needed

  console.log(`[Virgin Active] Fetching schedules from ${LONDON_CLUBS.length} London clubs...`);

  let allClasses = [];

  for (const club of LONDON_CLUBS) {
    try {
      const url = `${VIRGIN_ACTIVE_API}/getclubtimetable?id=${club.id}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        console.log(`[Virgin Active] API error for ${club.name}: ${res.status}`);
        continue;
      }

      const json = await res.json();
      const data = json.data || {};
      const classTimes = data.classTimes || [];
      const classes = data.classes || [];
      const instructors = data.instructors || [];

      // Build lookup maps
      const classMap = {};
      const instructorMap = {};

      classes.forEach(c => classMap[c.id] = c);
      instructors.forEach(i => instructorMap[i.id] = i);

      // Map class times to our format
      const clubClasses = classTimes.map(ct => {
        const classInfo = classMap[ct.classId] || {};
        const instructor = instructorMap[ct.instructorId] || {};

        const startTime = new Date(ct.startTime);
        const dateStr = startTime.toISOString().split('T')[0];
        const timeStr = startTime.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/London'
        });

        // Determine status
        let status = 'Open';
        if (ct.status === 'Full' || ct.booked >= ct.capacity) {
          status = ct.waitlistCapacity > 0 ? 'Waitlist' : 'Full';
        } else if (ct.status === 'Waitlist') {
          status = 'Waitlist';
        }

        return {
          gym_slug: 'virginactive',
          class_name: cleanTitle(classInfo.name || 'Class'),
          trainer: instructor.name || 'Staff',
          location: `Virgin Active ${club.name}`,
          date: dateStr,
          time: timeStr,
          status: status,
          link: `https://www.virginactive.co.uk/clubs/${club.slug}/timetable`,
          source_id: `virginactive-${club.id}-${ct.id}`
        };
      });

      allClasses = allClasses.concat(clubClasses);

    } catch (error) {
      console.error(`[Virgin Active] Error fetching ${club.name}: ${error.message}`);
    }
  }

  // Filter to next 14 days only
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);
  const todayStr = today.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const filteredClasses = allClasses.filter(c => c.date >= todayStr && c.date <= endStr);

  console.log(`[Virgin Active] ✓ ${filteredClasses.length} classes from ${LONDON_CLUBS.length} London clubs`);
  return filteredClasses;
}

export default scrapeVirginActive;
