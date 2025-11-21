import puppeteer from 'puppeteer';

export default async function scrapeShivaShakti(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log(`[Shiva Shakti] Navigating to API...`);
  
  try {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 14);
    
    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = nextMonth.toISOString().split('T')[0];

    const API_URL = `https://api.bsport.io/api/v1/offer?company=1433&min_date=${todayStr}&max_date=${endDateStr}&limit=100`;

    console.log(`[Shiva Shakti] Target URL: ${API_URL}`);

    await page.goto(API_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    const jsonText = await page.evaluate(() => document.body.innerText);

    let apiData = null;
    try {
        apiData = JSON.parse(jsonText);
    } catch (e) {
        console.log('[Shiva Shakti] Failed to parse JSON. Check browser window for errors.');
        return [];
    }

    if (!apiData || !apiData.results) {
        return [];
    }

    console.log(`[Shiva Shakti] ⚡️ Success! Downloaded ${apiData.results.length} classes.`);

    const processedClasses = apiData.results.map(item => {
        try {
            const startDateTime = new Date(item.date_start);
            const dateStr = startDateTime.toISOString().split('T')[0]; 
            const hours = startDateTime.getHours().toString().padStart(2, '0');
            const minutes = startDateTime.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;

            let instructor = "Staff";
            if (item.coach && item.coach.name) instructor = item.coach.name;
            
            let location = "Shakti Studio";
            if (item.establishment && item.establishment.name) location = item.establishment.name;

            let status = 'Open';
            if (item.spots_left === 0) status = 'Waitlist';
            if (item.booking_status === 'full') status = 'Full';

            return {
                gym: 'Shiva Shakti',
                raw_date: dateStr,
                start_time: timeStr,
                class_name: item.name || item.activity_name || "Yoga Class",
                instructor: instructor,
                location: location,
                status: status,
                link: "https://shivashaktistudios.com/schedule/"
            };
        } catch(e) { return null; }
    }).filter(c => c !== null);

    return processedClasses;

  } catch (err) {
      console.log(`[Shiva Shakti] Error: ${err.message}`);
      return [];
  } finally {
    await page.close();
  }
}