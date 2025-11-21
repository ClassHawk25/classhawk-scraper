import puppeteer from 'puppeteer';

export default async function scrapeBSTLagree(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  console.log(`[BST Lagree] -----------------------------------`);
  console.log(`[BST Lagree] Navigating to: ${config.url}`);
  
  let masterList = [];

  // HELPER: Calculate Date (Today + Offset)
  const calculateDate = (dayIndex, weekIndex) => {
      const today = new Date();
      // BST Lagree usually starts showing "Today" as the first button
      // Offset = (Week * 7) + Day Index
      const offset = (weekIndex * 7) + dayIndex;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);
      return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 1. Find the Mariana Iframe
    let targetFrame = null;
    await new Promise(r => setTimeout(r, 4000)); 

    const frames = page.frames();
    const marianaFrame = frames.find(f => f.url().includes('mariana') || f.url().includes('schedule'));
    
    if (marianaFrame) {
        targetFrame = marianaFrame;
    } else {
        console.log(`[BST Lagree] Could not isolate iframe. Trying main page.`);
        targetFrame = page.mainFrame();
    }

    // 2. Wait for Schedule
    try {
        await targetFrame.waitForSelector('button[data-test-date-button]', { timeout: 15000 });
        console.log(`[BST Lagree] Schedule loaded.`);
    } catch(e) {
        console.log(`[BST Lagree] Schedule failed to load.`);
        return [];
    }

    // 3. Loop for 2 Weeks
    for (let week = 0; week < 2; week++) {
        
        const daysCount = await targetFrame.evaluate(() => {
            return document.querySelectorAll('button[data-test-date-button]').length;
        });

        console.log(`[BST Lagree] Scraping Week ${week + 1} (${daysCount} days)...`);

        for (let dayIdx = 0; dayIdx < daysCount; dayIdx++) {
            
            // Click Day
            await targetFrame.evaluate((idx) => {
                const btns = document.querySelectorAll('button[data-test-date-button]');
                if (btns[idx]) btns[idx].click();
            }, dayIdx);

            await new Promise(r => setTimeout(r, 1500));

            // --- SCRAPE DAY ---
            const dailyClasses = await targetFrame.evaluate(() => {
                const results = [];
                
                // 1. Find Action Buttons
                const allElements = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
                const actionBtns = allElements.filter(el => {
                    if (el.children.length > 1) return false; 
                    const t = el.innerText.toUpperCase();
                    return (t.includes('RESERVE') || t.includes('WAITLIST') || t.includes('FULL') || t.includes('BOOK'));
                });

                actionBtns.forEach(btn => {
                    // Traverse UP to find the row
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

                        let class_name = "Lagree Class";
                        let instructor = "Staff";

                        const timeIndex = lines.findIndex(l => l.includes(timeFound));
                        if (timeIndex > -1 && lines[timeIndex + 1]) {
                            class_name = lines[timeIndex + 1];
                        }
                        if (timeIndex > -1 && lines[timeIndex + 2]) {
                            const candidate = lines[timeIndex + 2];
                            const badWords = ['RESERVE', 'WAITLIST', 'FULL', 'BOOK', 'AM', 'PM', 'MIN'];
                            if (!badWords.some(w => candidate.toUpperCase().includes(w))) {
                                instructor = candidate;
                            }
                        }
                        instructor = instructor.replace(/^with\s+/i, '');
                        if (instructor.includes('Angel') || instructor.includes('Classroom')) instructor = 'Staff';

                        const status = text.toUpperCase().includes('WAITLIST') ? 'Waitlist' : 'Open';

                        results.push({
                            gym: 'BST Lagree',
                            // We leave raw_date null here and fix it in Node
                            raw_date: null,
                            start_time: timeFound,
                            class_name,
                            instructor,
                            location: 'BST Lagree',
                            status
                        });
                    }
                });
                return results;
            });

            console.log(`[BST Lagree] Day ${dayIdx+1}: Found ${dailyClasses.length} classes.`);

            // --- ASSIGN UNIQUE DATES HERE ---
            const dateForThisLoop = calculateDate(dayIdx, week);
            
            const processedClasses = dailyClasses.map(c => ({
                ...c,
                raw_date: dateForThisLoop // <--- This guarantees uniqueness
            }));

            masterList = masterList.concat(processedClasses);
        }

        // Click Next Week
        const clickedNext = await targetFrame.evaluate(() => {
            const nextBtn = document.querySelector('button[aria-label="Next week"]');
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        });

        if (!clickedNext) break;
        await new Promise(r => setTimeout(r, 2500));
    }

  } catch (err) {
      console.log(`[BST Lagree] Error: ${err.message}`);
  } finally {
    await page.close();
  }

  // Deduplicate Global
  const finalUnique = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!seen.has(key)) {
          seen.add(key);
          finalUnique.push(c);
      }
  });

  console.log(`[BST Lagree] Success! Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}