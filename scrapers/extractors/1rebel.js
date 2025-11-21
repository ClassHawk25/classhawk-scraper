import puppeteer from 'puppeteer';

export default async function scrape1Rebel(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let allClasses = [];

  try {
    console.log(`[1Rebel] Starting scrape cycle...`);

    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; 
        const dailyUrl = `${config.url}?minDate=${dateStr}&maxDate=${dateStr}`;
        
        console.log(`[1Rebel] Loading date: ${dateStr}...`);
        await page.goto(dailyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForFunction(
                () => document.body.innerText.includes('BOOK') || document.body.innerText.includes('WAITLIST'),
                { timeout: 4000 }
            );
        } catch (e) { continue; }

        const dailyClasses = await page.evaluate((currentDateStr, bookingLink) => {
            const results = [];
            const allElements = Array.from(document.querySelectorAll('*'));
            
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
                    const text = row.innerText;
                    // Filter out empty lines
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    // KNOWN LOCATIONS LIST
                    const knownLocations = ['ST MARY AXE', 'BROADGATE', 'VICTORIA', 'ANGEL', 'SOUTH BANK', 'BAYSWATER', 'HAMMERSMITH', 'KENSINGTON', 'OXFORD CIRCUS', 'RIG', 'HIGH STREET KENSINGTON', 'ST JOHN\'S WOOD', 'HOLBORN'];
                    
                    // 1. Find Location Line
                    const locIndex = lines.findIndex(l => knownLocations.some(loc => l.toUpperCase().includes(loc)));
                    
                    let location = "1Rebel London";
                    let title = "1Rebel Class";
                    let trainer = "Staff";

                    if (locIndex > -1) {
                        location = lines[locIndex];
                        
                        // Title is usually BEFORE location (ignoring Time)
                        if (locIndex > 0 && !lines[locIndex - 1].includes(':')) {
                            title = lines[locIndex - 1];
                        }
                        
                        // Trainer is usually AFTER location
                        if (lines[locIndex + 1] && !lines[locIndex + 1].toUpperCase().includes('BOOK')) {
                            trainer = lines[locIndex + 1];
                        }
                    } else {
                        // Fallback if no location found (Use basic order)
                        // Time -> Title -> Trainer -> Button
                        const timeIndex = lines.findIndex(l => l.includes(timeFound));
                        if (lines[timeIndex + 1]) title = lines[timeIndex + 1];
                        if (lines[timeIndex + 2]) {
                             // Make sure it's not the location
                             if (!knownLocations.some(k => lines[timeIndex+2].toUpperCase().includes(k))) {
                                 trainer = lines[timeIndex + 2];
                             }
                        }
                    }

                    // Filter garbage
                    if (title.includes('WEBSITE') || title.includes('COOKIE')) return;
                    if (trainer.toUpperCase().includes('BOOK') || trainer.toUpperCase().includes('WAIT')) trainer = "Staff";

                    results.push({
                        gym: '1Rebel',
                        raw_date: currentDateStr,
                        start_time: timeFound,
                        class_name: title,
                        location: location,
                        instructor: trainer,
                        status: rawText.toUpperCase().includes('WAITLIST') || rawText.toUpperCase().includes('STANDBY') ? 'Waitlist' : 'Open',
                        link: bookingLink
                    });
                }
            });
            return results;
        }, dateStr, dailyUrl);

        allClasses = allClasses.concat(dailyClasses);
        await new Promise(r => setTimeout(r, 200));
    }

    const uniqueClasses = [];
    const seen = new Set();
    allClasses.forEach(c => {
        const key = `${c.raw_date}-${c.start_time}-${c.class_name}-${c.location}`;
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