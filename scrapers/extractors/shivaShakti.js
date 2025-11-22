import axios from 'axios';
import { format, addDays } from 'date-fns';

export default async function scrapeShivaShakti(browser, config) {
  console.log(`[Shiva Shakti] Initializing API Scraper...`);
  
  const COMPANY_ID = 1433;

  try {
    // 1. FETCH INSTRUCTORS DICTIONARY FIRST
    // We need to know who "47619" is.
    console.log(`[Shiva Shakti] Fetching instructor list...`);
    const coachUrl = `https://api.production.bsport.io/book/v1/coach/?company=${COMPANY_ID}&limit=100`;
    
    let coachMap = {};
    try {
        const coachRes = await axios.get(coachUrl, {
            headers: { 
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0" 
            }
        });
        
        // Create a lookup: { 47619: "Vanessa Hartley" }
        if (coachRes.data && coachRes.data.results) {
            coachRes.data.results.forEach(c => {
                // Combine first and last name
                const name = `${c.user.first_name} ${c.user.last_name || ''}`.trim();
                coachMap[c.id] = name;
            });
            console.log(`[Shiva Shakti] Loaded ${Object.keys(coachMap).length} instructors.`);
        }
    } catch (e) {
        console.log('[Shiva Shakti] Failed to load coach list. Will default to Staff.');
    }

    // 2. CALCULATE DATES
    const today = new Date();
    const startDateStr = format(today, "yyyy-MM-dd");
    const endDateStr = format(addDays(today, 14), "yyyy-MM-dd");

    // 3. FETCH CLASSES
    const url = `https://api.production.bsport.io/book/v1/offer/?company=${COMPANY_ID}&min_date=${startDateStr}&max_date=${endDateStr}&limit=100&coaches=&establishments=&activity__in=&levels=&establishment_group__in=&is_available=true&with_tags=true&only_future_strict=false&with_booking_window=true`;

    console.log(`[Shiva Shakti] Fetching schedule...`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://shivashaktistudios.com",
        "Referer": "https://shivashaktistudios.com/"
      },
    });

    const offers = response.data?.results || [];
    console.log(`[Shiva Shakti] ⚡️ API Success! Received ${offers.length} raw classes.`);

    if (offers.length === 0) return [];

    // 4. MAP THE DATA (Using the Coach Map)
    const processedClasses = offers.map((cls) => {
      const startDateTime = new Date(cls.date_start);
      const dateStr = format(startDateTime, "yyyy-MM-dd");
      const hours = startDateTime.getHours().toString().padStart(2, '0');
      const minutes = startDateTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // Title
      let title = cls.activity_name || cls.name;
      if (!title && cls.activity && cls.activity.name) title = cls.activity.name;
      if (!title) title = "Yoga Class"; 

      // Location
      let location = "Shakti Studio";
      if (cls.establishment && cls.establishment.name) location = cls.establishment.name;

      // --- INSTRUCTOR MAPPING (The Fix) ---
      let instructor = "Staff";
      
      // 1. Check if the ID matches our Lookup Map (e.g. 47619 -> Vanessa)
      if (cls.coach && coachMap[cls.coach]) {
          instructor = coachMap[cls.coach];
      } 
      // 2. Check Override (Substitute teacher object)
      else if (cls.coach_override && cls.coach_override.name) {
          instructor = cls.coach_override.name;
      }
      // 3. Fallback: Check if the API sent the full object anyway (rare but possible)
      else if (cls.coach && typeof cls.coach === 'object' && cls.coach.name) {
          instructor = cls.coach.name;
      }

      // Status
      let status = 'Open';
      if (cls.spots_left === 0) status = 'Waitlist';
      if (cls.booking_status === 'full') status = 'Full';

      return {
        gym: 'Shiva Shakti',
        raw_date: dateStr,
        start_time: timeStr,
        class_name: title,
        instructor: instructor,
        location: location,
        status: status,
        link: "https://shivashaktistudios.com/schedule/"
      };
    });

    // Deduplicate
    const uniqueClasses = [];
    const seen = new Set();
    processedClasses.forEach(c => {
        const key = `${c.raw_date}-${c.start_time}-${c.class_name}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueClasses.push(c);
        }
    });

    console.log(`[Shiva Shakti] Success! Clean Count: ${uniqueClasses.length}`);
    return uniqueClasses;

  } catch (err) {
    console.error(`[Shiva Shakti] Error: ${err.message}`);
    return [];
  }
}