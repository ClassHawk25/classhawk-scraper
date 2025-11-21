import puppeteer from 'puppeteer';

async function scrape1Rebel(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let allClasses = [];

  try {
    console.log(`[1Rebel] Starting scrape cycle...`);

    // Loop for the next 7 days
    for (let i = 0; i < 7; i++) {
        
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; 
        
        // We grab ALL locations by default
        const dailyUrl = `${config.url}?minDate=${dateStr}&maxDate=${dateStr}`;
        
        console.log(`[1Rebel] Loading date: ${dateStr}...`);
        await page.goto(dailyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForFunction(
                () => document.body.innerText.includes('BOOK') || document.body.innerText.includes('WAITLIST'),
                { timeout: 4000 }
            );
        } catch (e) {
            continue; 
        }

        const dailyClasses = await page.evaluate((currentDateStr) => {
            const results = [];
            const allElements = Array.from(document.querySelectorAll('*'));
            
            // Find elements that act as "Book" buttons
            const actionElements = allElements.filter(el => {
                if (el.children.length > 1) return false; 
                const t = el.innerText ? el.innerText.toUpperCase() : '';
                return t.includes('BOOK') || t.includes('WAITLIST') || t.includes('STANDBY');
            });

            actionElements.forEach(el => {
                let row = el.parentElement;
                let timeFound = null;
                let attempts = 0;
                const timeRegex = /\b\d{2}:\d{2}\b/; 

                while (row && attempts < 6) {
                    if (timeRegex.test(row.innerText)) {
                        timeFound = row.innerText.match(timeRegex)[0];
                        break;
                    }
                    row = row.parentElement;
                    attempts++;
                }

                if (row && timeFound) {
                    const rawText = row.innerText;
                    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    let title = "Unknown Class";
                    const knownLocations = ['ST MARY AXE', 'BROADGATE', 'VICTORIA', 'ANGEL', 'SOUTH BANK', 'BAYSWATER', 'HAMMERSMITH', 'KENSINGTON', 'OXFORD CIRCUS', 'RIG', 'HIGH STREET KENSINGTON'];
                    
                    const locLine = lines.find(l => knownLocations.some(loc => l.toUpperCase().includes(loc)));
                    
                    // --- DATA CLEANING SECTION ---
                    const potentialTitles = lines.filter(l => 
                        !l.includes(':') && 
                        l !== locLine && 
                        !l.toUpperCase().includes('BOOK') && 
                        !l.toUpperCase().includes('WAITLIST') &&
                        !l.toUpperCase().includes('STANDBY') &&      // Fix: Ignore 'Standby' button text
                        !l.toUpperCase().includes('SEARCH AGAIN') && // Fix: Ignore Search button
                        !l.toUpperCase().includes('COOKIES') &&      // Fix: Ignore Cookie banner
                        !l.toUpperCase().includes('RIGHTS RESERVED') && 
                        l.length > 2
                    );

                    if (potentialTitles.length > 0) title = potentialTitles[0];
                    let trainer = potentialTitles.length > 1 ? potentialTitles[potentialTitles.length - 1] : "Staff";

                    // Final Check: If the title is still garbage, skip it
                    if (title.includes('WEBSITE') || title.includes('COOKIE')) return;

                    results.push({
                        gym: '1Rebel',
                        date_string: currentDateStr,
                        start_time: timeFound,
                        class_name: title,
                        location: locLine || 'London',
                        instructor: trainer,
                        status: rawText.toUpperCase().includes('WAITLIST') || rawText.toUpperCase().includes('STANDBY') ? 'Waitlist' : 'Open'
                    });
                }
            });

            return results;
        }, dateStr);

        allClasses = allClasses.concat(dailyClasses);
        await new Promise(r => setTimeout(r, 200));
    }

    // Deduplicate
    const uniqueClasses = [];
    const seen = new Set();
    allClasses.forEach(c => {
        const key = `${c.date_string}-${c.start_time}-${c.class_name}-${c.location}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueClasses.push(c);
        }
    });

    console.log(`[1Rebel] Success! Found ${uniqueClasses.length} clean classes.`);
    return uniqueClasses;

  } catch (error) {
    console.error('[1Rebel] Error:', error);
    return [];
  } finally {
    await page.close();
  }
}

export default scrape1Rebel;