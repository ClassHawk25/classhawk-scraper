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
        
        // This URL is perfect for the user to book
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
                    const rawText = row.innerText;
                    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    const knownLocations = ['ST MARY AXE', 'BROADGATE', 'VICTORIA', 'ANGEL', 'SOUTH BANK', 'BAYSWATER', 'HAMMERSMITH', 'KENSINGTON', 'OXFORD CIRCUS', 'RIG', 'HIGH STREET KENSINGTON', 'ST JOHN\'S WOOD', 'HOLBORN'];
                    
                    let location = lines.find(l => knownLocations.some(loc => l.toUpperCase().includes(loc)));
                    if (!location) location = "1Rebel London";

                    const potentialTitles = lines.filter(l => !l.includes(':') && l !== location && !l.toUpperCase().includes('BOOK') && !l.toUpperCase().includes('WAITLIST') && !l.toUpperCase().includes('STANDBY') && l.length > 2);

                    let title = "Unknown Class";
                    if (potentialTitles.length > 0) title = potentialTitles[0];
                    
                    let trainer = "Staff";
                    if (potentialTitles.length > 1) trainer = potentialTitles[potentialTitles.length - 1];

                    if (title.includes('WEBSITE') || title.includes('COOKIE')) return;

                    results.push({
                        gym: '1Rebel',
                        raw_date: currentDateStr,
                        start_time: timeFound,
                        class_name: title,
                        location: location,
                        instructor: trainer,
                        status: rawText.toUpperCase().includes('WAITLIST') ? 'Waitlist' : 'Open',
                        link: bookingLink // <--- Added Link
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