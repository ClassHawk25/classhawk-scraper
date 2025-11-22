import axios from 'axios';
import { format, addDays } from 'date-fns';

export default async function scrapeShivaShakti(browser, config) {
  console.log(`[Shiva Shakti] Initializing API Scraper...`);
  
  const COMPANY_ID = 1433;
  let masterList = [];

  try {
    // 1. Calculate Dates
    const today = new Date();
    const startDateStr = format(today, "yyyy-MM-dd");
    const endDateStr = format(addDays(today, 14), "yyyy-MM-dd");

    // 2. Use the 'book' endpoint which usually has rich data
    const url = `https://api.production.bsport.io/book/v1/offer/?company=${COMPANY_ID}&min_date=${startDateStr}&max_date=${endDateStr}&limit=100&coaches=&establishments=&activity__in=&levels=&establishment_group__in=&is_available=true&with_tags=true&only_future_strict=false&with_booking_window=true`;

    console.log(`[Shiva Shakti] Fetching data from API...`);

    // 3. Fetch
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

    // 4. Map with ROBUST Fallbacks
    const processedClasses = offers.map((cls) => {
      // --- TIME MAPPING ---
      const startDateTime = new Date(cls.date_start);
      const dateStr = format(startDateTime, "yyyy-MM-dd");
      
      const hours = startDateTime.getHours().toString().padStart(2, '0');
      const minutes = startDateTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // --- TITLE MAPPING (The Fix) ---
      // Check 'activity_name' (from your screenshot) first
      let title = cls.activity_name || cls.name;
      
      // If that failed, check nested objects
      if (!title && cls.activity && cls.activity.name) title = cls.activity.name;
      if (!title && cls.meta_activity && cls.meta_activity.name) title = cls.meta_activity.name;
      
      // Fallback only if absolutely nothing found
      if (!title) title = "Yoga Class"; 

      // --- LOCATION MAPPING ---
      let location = "Shakti Studio";
      if (cls.establishment && cls.establishment.name) location = cls.establishment.name;

      // --- INSTRUCTOR MAPPING (The Fix) ---
      let instructor = "Staff";
      
      // Check for direct name on coach object
      if (cls.coach && cls.coach.name) {
          instructor = cls.coach.name;
      } 
      // Check for nested user object
      else if (cls.coach && cls.coach.user && cls.coach.user.first_name) {
          instructor = `${cls.coach.user.first_name} ${cls.coach.user.last_name || ''}`.trim();
      }
      // Check for override (Substitute teacher)
      else if (cls.coach_override && cls.coach_override.name) {
          instructor = cls.coach_override.name;
      }
      
      // Clean up weird formatting like "Vanessa H." -> "Vanessa Hartley" if available
      // (Not strictly necessary but good practice)

      // --- STATUS MAPPING ---
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