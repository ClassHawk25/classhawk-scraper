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
                const allElements = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
                const actionBtns = allElements.filter(el => {
                    if (el.children.length > 1) return false; 
                    const t = el.innerText.toUpperCase();
                    return (t.includes('RESERVE') || t.includes('WAITLIST') || t.includes('FULL') || t.includes('BOOK'));
                });

                actionBtns.forEach(btn => {
                    let row = btn.parentElement;
                    let timeFound = null;
                    let attempts = 0;
                    const timeRegex = /\b\d{1,2}:\d{2}\b/;

                    while (row && attempts < 8) {
                        if (timeRegex.test(row.innerText)) {
                            timeFound = row.innerText.match(timeRegex)[0];
                            break;
                        }
                        row = row.parentElement;
                        attempts++;
                    }

                    if (row && timeFound) {
                        const text = row.innerText;
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        
                        const timeMatch = lines.find(l => /\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(l));
                        const start_time = timeMatch ? timeMatch.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?/i)[0] : timeFound;

                        let class_name = lines.find(l => 
                            !l.includes(start_time) && !l.toLowerCase().includes('reserve') && !l.toLowerCase().includes('waitlist') && !l.toLowerCase().includes('full') && !l.toLowerCase().includes('book') && !l.toLowerCase().includes('min') && !l.toLowerCase().includes('only') && l.length > 3
                        );
                        if (!class_name) class_name = "Lagree Class";

                        const potentialInstructors = lines.filter(l => l !== class_name && !l.includes(start_time) && !l.toLowerCase().includes('min') && !l.toLowerCase().includes('reserve') && !l.toLowerCase().includes('waitlist') && l.length > 2);
                        let instructor = "Staff";
                        if (potentialInstructors.length > 0) instructor = potentialInstructors[0];
                        instructor = instructor.replace(/^with\s+/i, '');
                        if (instructor.includes('Angel') || instructor.includes('Classroom') || instructor.includes('Studio')) instructor = "Staff";

                        const status = text.toUpperCase().includes('WAITLIST') ? 'Waitlist' : 'Open';

                        results.push({
                            gym: 'BST Lagree',
                            raw_date: null, 
                            start_time: start_time,
                            class_name: class_name,
                            instructor: instructor,
                            location: 'BST Lagree',
                            status,
                            link: null // Filled in Node
                        });
                    }
                });
                return results;
            });

            const dateForThisLoop = calculateDate(dayIdx, week);
            const processedClasses = dailyClasses.map(c => ({
                ...c,
                raw_date: dateForThisLoop,
                link: config.url // <--- Main booking page link
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