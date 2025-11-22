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

        // Cookie Banner
        try {
            await new Promise(r => setTimeout(r, 3000));
            const cookieBtn = await page.$('#onetrust-accept-btn-handler');
            if (cookieBtn) {
                await cookieBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch(e) {}

        // Wait for Calendar Buttons
        console.log('[Virgin Active] Waiting for calendar buttons...');
        try {
            await page.waitForSelector('button[class*="date-filter-item"]', { timeout: 15000 });
        } catch(e) {
            console.log('[Virgin Active] Calendar buttons never appeared.');
            continue;
        }

        // Loop for 7 Days
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            
            const clicked = await page.evaluate((idx) => {
                const buttons = document.querySelectorAll('button[class*="date-filter-item"]');
                if (buttons[idx]) {
                    buttons[idx].click();
                    return true;
                }
                return false;
            }, dayIdx);

            if (!clicked) break;
            await new Promise(r => setTimeout(r, 2500));

            const dailyClasses = await page.evaluate((locName, classLink) => {
                const results = [];
                const rows = Array.from(document.querySelectorAll('.va_accordion-section, .class-timetable-row, dt[role="heading"]'));

                rows.forEach(row => {
                    // Time
                    const timeEl = row.querySelector('[class*="time"]');
                    if (!timeEl) return;
                    let start_time = timeEl.innerText.trim().split('-')[0].trim();

                    // Title
                    const titleEl = row.querySelector('[class*="title"]');
                    let class_name = titleEl ? titleEl.innerText.trim() : 'Virgin Class';
                    
                    // --- FIX: Remove Time from Title if present ---
                    // Example: "09:00 - BODYPUMP" -> "BODYPUMP"
                    if (class_name.match(/^\d{2}:\d{2}/)) {
                        class_name = class_name.replace(/^\d{2}:\d{2}\s*-\s*/, '').trim();
                    }

                    // Instructor
                    const trainerEl = row.querySelector('[class*="trainer"]');
                    let instructor = trainerEl ? trainerEl.innerText.trim() : 'Staff';

                    // Status / Link
                    const btnEl = row.querySelector('a[class*="cta"], a.btn');
                    let status = 'Open';
                    let link = classLink; 

                    if (btnEl) {
                        const btnText = btnEl.innerText.toUpperCase();
                        if (btnText.includes('FULL')) status = 'Full';
                        if (btnText.includes('WAITLIST')) status = 'Waitlist';
                        if (btnEl.href && !btnEl.href.includes('#')) link = btnEl.href;
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

  const finalUnique = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.location}-${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!seen.has(key)) {
          seen.add(key);
          finalUnique.push(c);
      }
  });

  console.log(`[Virgin Active] Success! Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}