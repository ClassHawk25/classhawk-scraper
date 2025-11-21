import puppeteer from 'puppeteer';

export default async function scrapeVirginActive(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  const formatLocation = (url) => {
      if (url.includes('crouch-end')) return 'Crouch End';
      if (url.includes('angel')) return 'Angel';
      return 'Virgin Active';
  };

  const calculateDate = (dayIndex) => {
      const today = new Date();
      const target = new Date(today);
      target.setDate(today.getDate() + dayIndex);
      return target.toISOString().split('T')[0];
  };

  for (const url of urls) {
      const locationName = formatLocation(url);
      console.log(`[Virgin Active] -----------------------------------`);
      console.log(`[Virgin Active] Navigating to: ${locationName}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. Cookie Banner Handling
        try {
            await new Promise(r => setTimeout(r, 2000));
            const cookieBtn = await page.$('#onetrust-accept-btn-handler');
            if (cookieBtn) {
                await cookieBtn.click();
                console.log('[Virgin Active] Cookie banner clicked.');
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch(e) {}

        // 2. CRITICAL FIX: Wait for the Date Buttons to actually exist
        console.log('[Virgin Active] Waiting for calendar buttons...');
        try {
            // We wait up to 15 seconds for the buttons to appear in the DOM
            await page.waitForSelector('button[class*="date-filter-item"]', { timeout: 15000 });
        } catch(e) {
            console.log('[Virgin Active] Calendar buttons never appeared. Page might be blank.');
            continue;
        }

        // 3. Loop for 7 Days
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            
            // Click the Date Button
            const clicked = await page.evaluate((idx) => {
                // Use a fuzzy selector to be safer
                const buttons = document.querySelectorAll('button[class*="date-filter-item"]');
                if (buttons[idx]) {
                    buttons[idx].click();
                    return true;
                }
                return false;
            }, dayIdx);

            if (!clicked) {
                console.log(`[Virgin Active] Day ${dayIdx+1} button not found. Stopping.`);
                break;
            }

            // Wait for accordion list to refresh
            await new Promise(r => setTimeout(r, 2000));

            // 4. Scrape the classes
            const dailyClasses = await page.evaluate((locName, classLink) => {
                const results = [];
                // Virgin uses 'dt' tags for rows usually, or divs with 'accordion' classes
                const rows = Array.from(document.querySelectorAll('.va_accordion-section, .class-timetable-row, dt[role="heading"]'));

                rows.forEach(row => {
                    // Time
                    const timeEl = row.querySelector('[class*="time"]');
                    if (!timeEl) return;
                    let start_time = timeEl.innerText.trim().split('-')[0].trim();

                    // Title
                    const titleEl = row.querySelector('[class*="title"]');
                    let class_name = titleEl ? titleEl.innerText.trim() : 'Virgin Class';

                    // Instructor
                    const trainerEl = row.querySelector('[class*="trainer"]');
                    let instructor = trainerEl ? trainerEl.innerText.trim() : 'Staff';

                    // Status / Link
                    const btnEl = row.querySelector('a[class*="cta"], a.btn');
                    let status = 'Open';
                    let link = classLink; // Default to timetable URL

                    if (btnEl) {
                        const btnText = btnEl.innerText.toUpperCase();
                        if (btnText.includes('FULL')) status = 'Full';
                        if (btnText.includes('WAITLIST')) status = 'Waitlist';
                        
                        // Virgin often puts the real booking link in the href
                        if (btnEl.href && !btnEl.href.includes('#')) {
                            link = btnEl.href;
                        }
                    }

                    results.push({
                        gym: 'Virgin Active',
                        raw_date: null, 
                        start_time,
                        class_name,
                        instructor,
                        location: locName,
                        status,
                        link
                    });
                });
                return results;
            }, locationName, url);

            const dateForThisLoop = calculateDate(dayIdx);
            const processed = dailyClasses.map(c => ({
                ...c,
                raw_date: dateForThisLoop
            }));

            console.log(`[Virgin Active] Day ${dayIdx+1}: Found ${processed.length} classes.`);
            masterList = masterList.concat(processed);
        }

      } catch (err) {
          console.log(`[Virgin Active] Error extracting ${url}: ${err.message}`);
      }
  }

  await page.close();

  // Deduplicate
  const uniqueClasses = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.location}-${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!seen.has(key)) {
          seen.add(key);
          uniqueClasses.push(c);
      }
  });

  console.log(`[Virgin Active] Success! Total Clean Count: ${uniqueClasses.length}`);
  return uniqueClasses;
}