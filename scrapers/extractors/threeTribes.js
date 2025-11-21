import puppeteer from 'puppeteer';

export default async function scrapeThreeTribes(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  // ---------------------------------------------------------
  // HELPER: Date Calculator
  // ---------------------------------------------------------
  const calculateDate = (startDateObj, dayIndex) => {
      const target = new Date(startDateObj); 
      target.setDate(target.getDate() + dayIndex);
      return target.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const formatLocation = (url) => {
      if (url.includes('borough')) return 'Borough';
      if (url.includes('crouch')) return 'Crouch End';
      return '3Tribes Studio';
  };

  for (const url of urls) {
      const locationName = formatLocation(url);
      console.log(`[3Tribes] -----------------------------------`);
      console.log(`[3Tribes] Navigating to: ${locationName}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. Find Frame
        let targetFrame = page.mainFrame();
        const frames = page.frames();
        const mbFrame = frames.find(f => f.url().includes('mindbody') || f.url().includes('healcode'));
        if (mbFrame) targetFrame = mbFrame;

        // 2. Wait for Widget
        try {
            await targetFrame.waitForSelector('.bw-session', { timeout: 15000 });
            console.log(`[3Tribes] Widget loaded.`);
        } catch(e) {
            console.log(`[3Tribes] Widget failed to load.`);
            continue;
        }

        // This tracks the "Start Date" of the list currently on screen
        let currentListStartDate = new Date();

        // 3. Loop for 4 Weeks
        for (let i = 0; i < 4; i++) {
            
            // --- SCRAPE THE CURRENT LIST ---
            const weeklyClasses = await targetFrame.evaluate((locName) => {
                const results = [];
                const dayColumns = document.querySelectorAll('.bw-widget__day');

                dayColumns.forEach((col, colIndex) => {
                    const sessions = col.querySelectorAll('.bw-session');
                    sessions.forEach(el => {
                        // Time
                        const timeEl = el.querySelector('.bw-session__time');
                        let start_time = timeEl ? timeEl.innerText.trim() : '00:00';
                        start_time = start_time.split(/\s[-–]\s/)[0].replace(' GMT', '').trim(); 

                        // Details
                        const nameEl = el.querySelector('.bw-session__name');
                        const class_name = nameEl ? nameEl.innerText.trim() : 'Unknown Class';
                        const trainerEl = el.querySelector('.bw-session__instructor');
                        const instructor = trainerEl ? trainerEl.innerText.trim() : 'Staff';
                        const status = el.innerText.toLowerCase().includes('waitlist') ? 'Waitlist' : 'Open';

                        results.push({
                            gym: '3Tribes',
                            col_index: colIndex, // Key for date calc
                            start_time,
                            class_name,
                            instructor,
                            location: locName,
                            status
                        });
                    });
                });
                return results;
            }, locationName);

            console.log(`[3Tribes] Week ${i+1}: Found ${weeklyClasses.length} classes.`);
            
            // --- ASSIGN DATES MATHEMATICALLY ---
            const processedClasses = weeklyClasses.map(c => {
                // The date is simply: Start of List + Column Index (0-6)
                const finalDate = calculateDate(currentListStartDate, c.col_index);
                return { 
                    gym: c.gym,
                    raw_date: finalDate,
                    start_time: c.start_time,
                    class_name: c.class_name,
                    instructor: c.instructor,
                    location: c.location,
                    status: c.status
                };
            });
            masterList = masterList.concat(processedClasses);

            // --- PREPARE FOR NEXT LOOP ---
            
            // 1. Calculate the target date for the NEXT batch (Current + 7 days)
            currentListStartDate.setDate(currentListStartDate.getDate() + 7);
            const targetDayNum = currentListStartDate.getDate(); // e.g. 5

            // 2. Click "Full Calendar"
            const opened = await targetFrame.evaluate(() => {
                const btn = document.querySelector('.bw-fullcal-button');
                if (btn) { btn.click(); return true; }
                return false;
            });

            if (!opened) {
                console.log('[3Tribes] "Full Calendar" button not found. Stopping.');
                break;
            }
            await new Promise(r => setTimeout(r, 1000));

            // 3. SMART DATE PICKER ("Find or Flip")
            const dayClicked = await targetFrame.evaluate(async (dayNum) => {
                
                // Helper to find a clickable day cell with specific text
                const findDay = () => {
                    const cells = Array.from(document.querySelectorAll('td'));
                    return cells.find(c => 
                        c.innerText.trim() == dayNum && 
                        !c.classList.contains('is-disabled') && // Not disabled
                        !c.classList.contains('is-outside-current-month') // Is in current view
                    );
                };

                let cell = findDay();

                // IF WE CANT FIND THE DAY... WE MUST BE IN THE WRONG MONTH
                if (!cell) {
                    // Click "Next Month" arrow
                    // Try standard Pika/Healcode classes
                    const nextArrow = document.querySelector('.pika-next') || document.querySelector('.bw-calendar-next');
                    if (nextArrow) {
                        nextArrow.click();
                        // We must return 'WAIT' to tell Node to pause before retrying
                        return 'WAIT'; 
                    }
                }

                // Try finding it again (if we didn't switch months)
                if (cell) {
                    cell.click();
                    return 'CLICKED';
                }
                
                return 'FAILED';
            }, targetDayNum);

            // If the browser said "WAIT", it means it clicked "Next Month". 
            // We wait, then try to click the day again.
            if (dayClicked === 'WAIT') {
                // Wait for calendar animation
                await new Promise(r => setTimeout(r, 1000));
                
                // Click the day now that we are in the new month
                await targetFrame.evaluate((dayNum) => {
                    const cells = Array.from(document.querySelectorAll('td'));
                    const cell = cells.find(c => c.innerText.trim() == dayNum && !c.classList.contains('is-disabled'));
                    if (cell) cell.click();
                }, targetDayNum);
            }

            // 4. Click OK
            await new Promise(r => setTimeout(r, 500));
            await targetFrame.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const ok = buttons.find(b => b.innerText === 'OK');
                if (ok) ok.click();
            });

            // Wait for the new list to load
            await new Promise(r => setTimeout(r, 4000));
        }

      } catch (err) {
          console.log(`[3Tribes] Error extracting ${url}: ${err.message}`);
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

  console.log(`[3Tribes] Success! Total Clean Count: ${uniqueClasses.length}`);
  return uniqueClasses;
}