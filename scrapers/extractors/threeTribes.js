import puppeteer from 'puppeteer';

export default async function scrapeThreeTribes(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

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
      console.log(`[3Tribes] Navigating to: ${locationName}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        let targetFrame = page.mainFrame();
        const frames = page.frames();
        const mbFrame = frames.find(f => f.url().includes('mindbody') || f.url().includes('healcode'));
        if (mbFrame) targetFrame = mbFrame;

        try {
            await targetFrame.waitForSelector('.bw-session', { timeout: 15000 });
        } catch(e) { continue; }

        let currentListStartDate = new Date();

        for (let i = 0; i < 4; i++) {
            const weeklyClasses = await targetFrame.evaluate((locName) => {
                const results = [];
                const dayColumns = document.querySelectorAll('.bw-widget__day');

                dayColumns.forEach((col, colIndex) => {
                    const sessions = col.querySelectorAll('.bw-session');
                    sessions.forEach(el => {
                        const timeEl = el.querySelector('.bw-session__time');
                        let start_time = timeEl ? timeEl.innerText.trim() : '00:00';
                        start_time = start_time.split(/\s[-–]\s/)[0].replace(' GMT', '').trim(); 

                        const nameEl = el.querySelector('.bw-session__name');
                        const class_name = nameEl ? nameEl.innerText.trim() : 'Unknown Class';
                        const trainerEl = el.querySelector('.bw-session__instructor');
                        const instructor = trainerEl ? trainerEl.innerText.trim() : 'Staff';
                        const status = el.innerText.toLowerCase().includes('waitlist') ? 'Waitlist' : 'Open';

                        results.push({
                            gym: '3Tribes',
                            col_index: colIndex, 
                            start_time,
                            class_name,
                            instructor,
                            location: locName,
                            status,
                            link: null // Filled in Node with the URL
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
                    link: url // <--- Use the booking page URL
                };
            });
            masterList = masterList.concat(processedClasses);

            // Navigation logic (same as before)
            currentListStartDate.setDate(currentListStartDate.getDate() + 7);
            const targetDayNum = currentListStartDate.getDate(); 

            const opened = await targetFrame.evaluate(() => {
                const btn = document.querySelector('.bw-fullcal-button');
                if (btn) { btn.click(); return true; }
                return false;
            });
            if (!opened) break;
            
            await new Promise(r => setTimeout(r, 1000));

            const dayClicked = await targetFrame.evaluate(async (dayNum) => {
                const findDay = () => {
                    const cells = Array.from(document.querySelectorAll('td'));
                    return cells.find(c => c.innerText.trim() == dayNum && !c.classList.contains('is-disabled') && !c.classList.contains('is-outside-current-month'));
                };
                let cell = findDay();
                if (!cell) {
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
      } catch (err) { console.log(`[3Tribes] Error: ${err.message}`); }
  }

  await page.close();
  const uniqueClasses = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.location}-${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!seen.has(key)) { seen.add(key); uniqueClasses.push(c); }
  });
  console.log(`[3Tribes] Success! Total Clean Count: ${uniqueClasses.length}`);
  return uniqueClasses;
}