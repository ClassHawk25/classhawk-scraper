import puppeteer from 'puppeteer';

export default async function scrapeThreeTribes(browser, config) {
  const page = await browser.newPage();
  // Wide viewport for calendar popup
  await page.setViewport({ width: 1300, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  // Helper: Date Calculator
  const calculateDate = (startDateObj, dayIndex) => {
      const target = new Date(startDateObj); 
      target.setDate(target.getDate() + dayIndex);
      return target.toISOString().split('T')[0]; 
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

        let currentListStartDate = new Date();

        // 3. Loop for 4 Weeks
        for (let i = 0; i < 4; i++) {
            
            // --- SCRAPE DATA ---
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

                        // Class Name
                        const nameEl = el.querySelector('.bw-session__name');
                        const class_name = nameEl ? nameEl.innerText.trim() : 'Unknown Class';

                        // --- INSTRUCTOR FIX ---
                        let instructor = 'Staff';
                        
                        // 1. Try the dedicated instructor element
                        const trainerEl = el.querySelector('.bw-session__instructor');
                        if (trainerEl) {
                            let text = trainerEl.innerText.trim();
                            // Remove "with " prefix if present
                            if (text.toLowerCase().startsWith('with ')) {
                                text = text.substring(5).trim();
                            }
                            // Remove "w/ " prefix
                            if (text.toLowerCase().startsWith('w/ ')) {
                                text = text.substring(3).trim();
                            }
                            
                            if (text.length > 1) instructor = text;
                        }

                        // 2. Fallback: If still "Staff", check row text for "with [Name]"
                        if (instructor === 'Staff') {
                            const fullText = el.innerText;
                            const withMatch = fullText.match(/with\s+([A-Za-z]+)/i);
                            if (withMatch && withMatch[1]) {
                                instructor = withMatch[1];
                            }
                        }

                        const status = el.innerText.toLowerCase().includes('waitlist') ? 'Waitlist' : 'Open';

                        results.push({
                            gym: '3Tribes',
                            col_index: colIndex, 
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
            
            const processedClasses = weeklyClasses.map(c => {
                const finalDate = calculateDate(currentListStartDate, c.col_index);
                return { 
                    gym: c.gym,
                    raw_date: finalDate,
                    start_time: c.start_time,
                    class_name: c.class_name,
                    instructor: c.instructor,
                    location: c.location,
                    status: c.status,
                    link: url 
                };
            });
            masterList = masterList.concat(processedClasses);

            // --- NAVIGATION ---
            currentListStartDate.setDate(currentListStartDate.getDate() + 7);
            const targetDayNum = currentListStartDate.getDate(); 

            const opened = await targetFrame.evaluate(() => {
                const btn = document.querySelector('.bw-fullcal-button');
                if (btn) { btn.click(); return true; }
                return false;
            });

            if (!opened) break;
            await new Promise(r => setTimeout(r, 1000));

            // Smart Date Picker
            const dayClicked = await targetFrame.evaluate(async (dayNum) => {
                const findDay = () => {
                    const cells = Array.from(document.querySelectorAll('td'));
                    return cells.find(c => c.innerText.trim() == dayNum && !c.classList.contains('is-disabled') && !c.classList.contains('is-outside-current-month'));
                };
                
                let cell = findDay();
                if (!cell) {
                    // Flip month if day not found
                    const nextArrow = document.querySelector('.pika-next') || document.querySelector('.bw-calendar-next');
                    if (nextArrow) { nextArrow.click(); return 'WAIT'; }
                }
                if (cell) { cell.click(); return 'CLICKED'; }
                return 'FAILED';
            }, targetDayNum);

            if (dayClicked === 'WAIT') {
                await new Promise(r => setTimeout(r, 1000));
                await targetFrame.evaluate((dayNum) => {
                    const cells = Array.from(document.querySelectorAll('td'));
                    const cell = cells.find(c => c.innerText.trim() == dayNum && !c.classList.contains('is-disabled'));
                    if (cell) cell.click();
                }, targetDayNum);
            }

            await new Promise(r => setTimeout(r, 500));
            await targetFrame.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const ok = buttons.find(b => b.innerText === 'OK');
                if (ok) ok.click();
            });

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