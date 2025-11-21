import puppeteer from 'puppeteer';

export default async function scrapeBSTLagree(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  console.log(`[BST Lagree] Navigating to: ${config.url}`);
  let masterList = [];

  const calculateDate = (dayIndex, weekIndex) => {
      const today = new Date();
      const offset = (weekIndex * 7) + dayIndex;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);
      return targetDate.toISOString().split('T')[0]; 
  };

  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

    let targetFrame = null;
    await new Promise(r => setTimeout(r, 4000)); 
    const frames = page.frames();
    const marianaFrame = frames.find(f => f.url().includes('mariana') || f.url().includes('schedule'));
    if (marianaFrame) targetFrame = marianaFrame;
    else targetFrame = page.mainFrame();

    try {
        await targetFrame.waitForSelector('button[data-test-date-button]', { timeout: 15000 });
    } catch(e) { return []; }

    for (let week = 0; week < 2; week++) {
        const daysCount = await targetFrame.evaluate(() => document.querySelectorAll('button[data-test-date-button]').length);
        console.log(`[BST Lagree] Scraping Week ${week + 1}...`);

        for (let dayIdx = 0; dayIdx < daysCount; dayIdx++) {
            await targetFrame.evaluate((idx) => {
                const btns = document.querySelectorAll('button[data-test-date-button]');
                if (btns[idx]) btns[idx].click();
            }, dayIdx);
            await new Promise(r => setTimeout(r, 1500));

            const dailyClasses = await targetFrame.evaluate(() => {
                const results = [];
                const dateHeader = document.querySelector('h2, .header-date');
                const raw_date = dateHeader ? dateHeader.innerText.trim() : 'Unknown Date';

                const allDivs = Array.from(document.querySelectorAll('div, li'));
                const classRows = allDivs.filter(div => {
                    const t = div.innerText.toLowerCase();
                    return /\b\d{1,2}:\d{2}\b/.test(div.innerText) && 
                           (t.includes('reserve') || t.includes('waitlist') || t.includes('full')) && 
                           div.innerText.length < 300;
                });

                classRows.forEach(row => {
                    const text = row.innerText; 
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    // 1. FIND TIME
                    const timeMatch = lines.find(l => /\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(l));
                    const start_time = timeMatch ? timeMatch.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i)[0] : '00:00';

                    // 2. FIND LOCATION (Angel, etc.)
                    // We check if any line matches known locations.
                    const knownLocations = ['Angel', 'Shoreditch', 'Chelsea', 'Victoria', 'Kensington'];
                    let location = lines.find(l => knownLocations.some(loc => l.includes(loc)));
                    if (!location) location = "BST Lagree"; // Default

                    // 3. FIND TITLE
                    // Must NOT be time, NOT be location, NOT be duration ("min"), NOT be button
                    let class_name = lines.find(l => 
                        !l.includes(start_time) && 
                        l !== location &&
                        !l.toLowerCase().includes('min') && 
                        !l.toLowerCase().includes('reserve') && 
                        !l.toLowerCase().includes('waitlist') && 
                        !l.toLowerCase().includes('full') &&
                        !l.toLowerCase().includes('book') &&
                        l.length > 3
                    );
                    if (!class_name) class_name = "Lagree Class";

                    // 4. FIND INSTRUCTOR
                    // It is the line that is NOT Title, NOT Time, NOT Location
                    const potentialInstructors = lines.filter(l => 
                        l !== class_name &&
                        l !== location &&
                        !l.includes(start_time) &&
                        !l.toLowerCase().includes('min') &&
                        !l.toLowerCase().includes('reserve') &&
                        !l.toLowerCase().includes('waitlist') &&
                        l.length > 2
                    );

                    let instructor = "Staff";
                    if (potentialInstructors.length > 0) instructor = potentialInstructors[0];
                    
                    instructor = instructor.replace(/^with\s+/i, '');
                    // If it accidentally grabbed "Angel Classroom", clean it up
                    if (instructor.includes('Classroom') || instructor.includes('Studio')) instructor = "Staff";

                    const status = text.toUpperCase().includes('WAITLIST') ? 'Waitlist' : 'Open';

                    results.push({
                        gym: 'BST Lagree',
                        raw_date: null, 
                        start_time: start_time,
                        class_name: class_name,
                        instructor: instructor,
                        location: location,
                        status,
                        link: null 
                    });
                });
                return results;
            });

            const dateForThisLoop = calculateDate(dayIdx, week);
            const processedClasses = dailyClasses.map(c => ({
                ...c,
                raw_date: dateForThisLoop,
                link: config.url 
            }));
            masterList = masterList.concat(processedClasses);
        }

        const clickedNext = await targetFrame.evaluate(() => {
            const nextBtn = document.querySelector('button[aria-label="Next week"]');
            if (nextBtn) { nextBtn.click(); return true; }
            return false;
        });
        if (!clickedNext) break;
        await new Promise(r => setTimeout(r, 2500));
    }
  } catch (err) { console.log(`[BST Lagree] Error: ${err.message}`); }
  finally { await page.close(); }

  const finalUnique = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!seen.has(key)) { seen.add(key); finalUnique.push(c); }
  });
  console.log(`[BST Lagree] Success! Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}