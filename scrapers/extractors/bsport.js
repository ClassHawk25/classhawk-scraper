// scrapers/extractors/bsport.js
const BSPORT_API = 'https://api.production.bsport.io';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
};

const LONDON_AREAS = {
  'E1': 'Whitechapel', 'E2': 'Bethnal Green', 'E8': 'Hackney', 'E14': 'Canary Wharf',
  'EC1': 'Clerkenwell', 'EC2': 'Liverpool Street', 'EC3': 'Tower Hill', 'EC4': 'St Pauls',
  'N1': 'Islington', 'N4': 'Finsbury Park', 'N8': 'Hornsey', 'NW1': 'Camden', 'NW3': 'Hampstead',
  'SE1': 'Southwark', 'SE3': 'Blackheath', 'SE5': 'Camberwell', 'SE10': 'Greenwich', 'SE15': 'Peckham',
  'SE22': 'East Dulwich', 'SE19': 'Crystal Palace',
  'SW1': 'Westminster', 'SW2': 'Brixton', 'SW3': 'Chelsea', 'SW4': 'Clapham', 'SW6': 'Fulham',
  'SW7': 'South Kensington', 'SW11': 'Battersea', 'SW15': 'Putney', 'SW17': 'Tooting', 'SW18': 'Wandsworth', 'SW19': 'Wimbledon',
  'W1': 'West End', 'W2': 'Paddington', 'W4': 'Chiswick', 'W6': 'Hammersmith', 'W8': 'Kensington',
  'W10': 'Ladbroke Grove', 'W11': 'Notting Hill', 'W12': 'Shepherds Bush',
  'WC1': 'Bloomsbury', 'WC2': 'Covent Garden'
};

function getAreaFromPostcode(postcode) {
  if (!postcode) return null;
  const district = postcode.toUpperCase().match(/^([A-Z]{1,2}\d{1,2})/)?.[1];
  return LONDON_AREAS[district] || null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/['']/g, '')           // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')    // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '');         // Trim hyphens
}

async function getCoaches(companyId) {
  const res = await fetch(`${BSPORT_API}/core-data/v1/associated_coach/?company=${companyId}`, { headers: HEADERS });
  if (!res.ok) return {};
  const data = await res.json();
  const coaches = {};
  for (const coach of data.results || data || []) {
    coaches[coach.id] = coach.name || `${coach.firstname || ''} ${coach.lastname || ''}`.trim() || 'Instructor';
  }
  return coaches;
}

async function getEstablishments(companyId) {
  const res = await fetch(`${BSPORT_API}/core-data/v1/establishment/?company=${companyId}`, { headers: HEADERS });
  if (!res.ok) return {};
  const data = await res.json();
  const establishments = {};
  for (const est of data.results || data || []) {
    // Store full establishment info for location building
    establishments[est.id] = {
      name: est.title || 'Studio',
      city: est.location?.city || 'London',
      postcode: est.location?.zipcode || ''
    };
  }
  return establishments;
}

async function getClasses(companyId, studioName, gymSlug, scheduleUrl, websiteUrl) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);  // 2 weeks ahead

  const minDate = today.toISOString().split('T')[0];
  const maxDate = endDate.toISOString().split('T')[0];

  let allClasses = [];
  let page = 1;

  // Get coach and location names first
  const coaches = await getCoaches(companyId);
  const establishments = await getEstablishments(companyId);

  while (true) {
    const url = `${BSPORT_API}/book/v1/offer/?company=${companyId}&min_date=${minDate}&max_date=${maxDate}&page=${page}&page_size=100`;
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) break;

    const data = await res.json();
    const classes = data.results || data || [];

    if (classes.length === 0) break;

    allClasses = allClasses.concat(classes);

    // Check if there's more pages
    if (!data.next) break;
    page++;
  }

  // Default link - prefer scheduleUrl (booking page), then websiteUrl (homepage), else Google search
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(studioName + ' book class london')}`;
  const defaultLink = scheduleUrl || websiteUrl || googleSearchUrl;

  return allClasses.map(cls => {
    const startDate = new Date(cls.date_start);
    const coachName = coaches[cls.coach] || 'Instructor';

    // Get establishment info for location - show "Venue Name, Area Name"
    // If venue name matches or contains area name, just show venue name (avoid "Fulham, Fulham" or "Wandsworth NEW, Wandsworth")
    const est = establishments[cls.establishment] || {};
    const venueName = est.name || 'Studio';
    const area = getAreaFromPostcode(est.postcode);
    const venueLC = venueName.toLowerCase();
    const areaLC = area?.toLowerCase() || '';
    const location = !area ? venueName
      : (venueLC === areaLC || venueLC.includes(areaLC)) ? venueName
      : `${venueName}, ${area}`;

    const totalSpots = cls.effectif || null;
    const bookedSpots = cls.validated_booking_count || 0;
    const available = totalSpots ? totalSpots - bookedSpots : null;

    return {
      gym_slug: gymSlug,
      class_name: cls.activity_name || cls.name || 'Class',
      trainer: coachName,
      location: location,
      date: startDate.toISOString().split('T')[0],
      time: startDate.toTimeString().slice(0, 5),
      status: cls.full ? 'Full' : 'Open',
      link: defaultLink,
      spots_available: available,
      spots_total: totalSpots,
      duration_minutes: cls.duration_minute || null,
      // Stable ID for deduplication - BSport offer ID doesn't change
      source_id: `bsport-${cls.id}`
    };
  });
}

async function scrapeBSport(browser, config) {
  console.log('   [BSport] Starting API-based scrape...');

  const allClasses = [];

  for (const studio of config.studios) {
    console.log(`   [BSport] 📍 Fetching ${studio.name}...`);

    try {
      const gymSlug = slugify(studio.name);
      const classes = await getClasses(studio.companyId, studio.name, gymSlug, studio.scheduleUrl, studio.websiteUrl);

      if (classes.length > 0) {
        console.log(`   [BSport]    ✓ ${studio.name}: ${classes.length} classes`);
        allClasses.push(...classes);
      } else {
        console.log(`   [BSport]    ⚠️ ${studio.name}: 0 classes`);
      }

      await delay(500);
    } catch (error) {
      console.error(`   [BSport]    ❌ ${studio.name}: ${error.message}`);
    }
  }

  console.log(`   [BSport] ✅ Complete: ${allClasses.length} classes`);
  return allClasses;
}

export default scrapeBSport;
