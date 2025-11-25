import axios from 'axios';
import { format, addDays } from 'date-fns';

export default async function scrapeShivaShakti(browser, config) {
  console.log(`[Shiva Shakti] Initializing API Scraper (Reliable Mode)...`);
  
  const COMPANY_ID = 1433;
  // These headers mimic a real browser to ensure the API accepts us
  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://shivashaktistudios.com",
    "Referer": "https://shivashaktistudios.com/"
  };

  try {
    // 1. CALCULATE DATES
    const today = new Date();
    const startDateStr = format(today, "yyyy-MM-dd");
    const endDateStr = format(addDays(today, 14), "yyyy-MM-dd");

    // 2. FETCH CLASSES DIRECTLY
    // We removed the complex 'include=coach' params to keep the request clean and stable
    const url = `https://api.production.bsport.io/book/v1/offer/?company=${COMPANY_ID}&min_date=${startDateStr}&max_date=${endDateStr}&limit=100&is_available=true&with_tags=true`;

    console.log(`[Shiva Shakti] Fetching schedule...`);
    const response = await axios.get(url, { headers: HEADERS });

    const offers = response.data?.results || [];
    console.log(`[Shiva Shakti] ⚡️ API Success! Received ${offers.length} raw classes.`);

    if (offers.length === 0) return [];

    // 3. MAP DATA (Simple & Robust)
    const processedClasses = offers.map((cls) => {
      // Parse Date & Time
      const startDateTime = new Date(cls.date_start);
      const dateStr = format(startDateTime, "yyyy-MM-dd");
      const hours = startDateTime.getHours().toString().padStart(2, '0');
      const minutes = startDateTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // Title & Location
      let title = cls.activity_name || cls.name;
      if (!title && cls.activity && cls.activity.name) title = cls.activity.name;
      if (!title) title = "Yoga Class"; 

      let location = "Shakti Studio";
      if (cls.establishment && cls.establishment.name) location = cls.establishment.name;

      // Status Logic
      let status = 'Open';
      if (cls.spots_left === 0) status = 'Waitlist';
      if (cls.booking_status === 'full') status = 'Full';

      return {
        gym_slug: 'shiva-shakti',
        date: dateStr,
        time: timeStr,
        class_name: title,
        trainer: "Staff", // Reliability decision: Default to Staff to prevent errors
        location: location,
        status: status,
        link: "https://shivashaktistudios.com/schedule/"
      };
    });

    // 4. DEDUPLICATE
    const uniqueClasses = [];
    const seen = new Set();
    processedClasses.forEach(c => {
        const key = `${c.date}-${c.time}-${c.class_name}`;
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