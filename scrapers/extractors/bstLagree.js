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
                // Use 'article' or 'li' as row containers based on typical Mariana layout
                // Falling back to divs that look like rows
                const allDivs = Array.from(document.querySelectorAll('div'));
                
                const classRows = allDivs.filter(div => {
                    const t = div.innerText;
                    // Strict check: Must have Time AND Duration AND Button
                    return /\b\d{1,2}:\d{2}\b/.test(t) && 
                           t.includes('min.') && 
                           (t.toUpperCase().includes('RESERVE') || t.toUpperCase().includes('WAITLIST'));
                });

                // Filter out parent containers by picking the smallest ones
                // This prevents us from scraping the whole page as one class
                const leafRows = classRows.filter(r => r.innerText.length < 400);

                leafRows.forEach(row => {
                    const text = row.innerText; 
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    // 1. Find Time Line Index
                    const timeIndex = lines.findIndex(l => /\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(l));
                    if (timeIndex === -1) return;

                    const start_time = lines[timeIndex].match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i)[0];

                    // 2. Positional Extraction (Based on your screenshot)
                    // Time -> Duration -> Title -> Instructor -> Room -> Location
                    
                    let class_name = "Lagree Class";
                    let instructor = "Staff";
                    let location = "BST Lagree";

                    // We look for the line AFTER the duration "45 min."
                    const durationIndex = lines.findIndex((l, i) => i > timeIndex && l.includes('min.'));
                    
                    if (durationIndex > -1 && lines[durationIndex + 1]) {
                        class_name = lines[durationIndex + 1]; // Title is after duration
                        
                        if (lines[durationIndex + 2]) {
                            instructor = lines[durationIndex + 2]; // Instructor is after Title
                        }
                        
                        // Try to find location (Angel/Shoreditch)
                        // It is usually near the bottom, or 2 lines after instructor
                        if (lines[durationIndex + 4]) {
                             const potentialLoc = lines[durationIndex + 4];
                             if (potentialLoc === 'Angel' || potentialLoc === 'Shoreditch' || potentialLoc === 'Chelsea') {
                                 location = potentialLoc;
                             }
                        }
                    }

                    // Cleanup
                    if (instructor.includes('Classroom') || instructor.includes('Studio')) instructor = "Staff";

                    const status = text.toUpperCase().includes('WAITLIST') ? 'Waitlist' : 'Open';

                    results.push({
                        gym: 'BST Lagree',
                        raw_date: null, 
                        start_time,
                        class_name,
                        instructor,
                        location,
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