// scrapers/extractors/1rebel.js
import puppeteer from 'puppeteer';

export default async function scrape1Rebel(browser, config) {
  const targetUrl = 'https://www.1rebel.com/en-gb/reserve';
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200 });

  let allClasses = [];

  try {
    console.log(`[1Rebel] 🚀 Starting Scrape (Tunnel Vision Mode)...`);

    // 1. LOAD PAGE
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. COOKIEBOT
    console.log("   🍪 Handling Cookiebot...");
    try {
        const cookieBtn = await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 5000 });
        if (cookieBtn) await cookieBtn.click();
    } catch(e) {
        // Nuke fallback
        await page.evaluate(() => {
            const b = document.getElementById('CybotCookiebotDialog');
            if(b) b.remove();
        });
    }

    // 3. REGION CHECK
    try {
        const text = await page.evaluate(() => document.body.innerText);
        if (text.includes('CHOOSE LOCATION')) {
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const uk = links.find(l => l.innerText.includes('VISIT SITE') && l.href.includes('en-gb'));
                if (uk) uk.click();
            });
            await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        }
    } catch(e) {}

    // --- DATE LOOP ---
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; 
        
        const dailyUrl = `https://www.1rebel.com/en-gb/reserve?minDate=${dateStr}&maxDate=${dateStr}`;
        
        console.log(`[1Rebel] Loading date: ${dateStr}...`);
        await page.goto(dailyUrl, { waitUntil: 'networkidle2' });

        // WAIT FOR DATA
        try {
            await page.waitForFunction(
                () => document.body.innerText.includes('BOOK NOW') || document.body.innerText.includes('WAITLIST'),
                { timeout: 8000 }
            );
        } catch(e) {
            console.log(`   ⚠️ No classes found for ${dateStr}.`);
            continue;
        }

        // 4. EXTRACT DATA (With Depth Limiter)
        const dailyClasses = await page.evaluate((currentDateStr) => {
            const results = [];
            
            // Find valid buttons
            const buttons = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
            const bookButtons = buttons.filter(b => {
                // Must be visible
                if (b.offsetParent === null) return false;
                const t = b.innerText.toUpperCase();
                return t.includes('BOOK') || t.includes('WAITLIST') || t.includes('STANDBY');
            });

            bookButtons.forEach(btn => {
                // --- THE FIX IS HERE ---
                // Instead of jumping to the closest 'tr', we walk up cautiously.
                // We check if the current container HAS a time. If so, we stop.
                
                let container = btn.parentElement;
                let timeFound = null;
                const timeRegex = /(\d{1,2}:\d{2})/;
                let levels = 0;

                // Walk up max 5 levels looking for a Time
                while (container && levels < 5) {
                    const text = container.innerText || "";
                    // Check if this specific container has a time match
                    // AND ensure the text isn't massive (like the whole page)
                    if (timeRegex.test(text) && text.length < 500) {
                        timeFound = text.match(timeRegex)[0];
                        break; // STOP here, this is our row
                    }
                    container = container.parentElement;
                    levels++;
                }

                if (container && timeFound) {
                    const text = container.innerText;
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    
                    // Standardize Time
                    if (timeFound.length === 4) timeFound = "0" + timeFound;

                    // Parse Location/Name
                    let location = "1Rebel London";
                    let className = "1Rebel Class";
                    let trainer = "Staff";

                    const knownLocs = ['ANGEL', 'BROADGATE', 'VICTORIA', 'SOUTH BANK', 'ST MARY AXE', 'BAYSWATER', 'HOLBORN', 'KENSINGTON', 'OXFORD CIRCUS', 'ST JOHNS WOOD', 'HAMMERSMITH'];
                    const locIndex = lines.findIndex(l => knownLocs.some(loc => l.toUpperCase().includes(loc)));
                    
                    if (locIndex > -1) {
                        location = lines[locIndex];
                        if (locIndex > 0 && !lines[locIndex-1].includes(':')) className = lines[locIndex-1];
                        if (lines[locIndex+1]) {
                             const pt = lines[locIndex+1].toUpperCase();
                             if (!pt.includes('BOOK')) trainer = lines[locIndex+1];
                        }
                    } else {
                        // Fallback logic
                        // Remove time from lines to avoid confusion
                        const cleanLines = lines.filter(l => !l.includes(timeFound));
                        if (cleanLines[0]) className = cleanLines[0];
                        if (cleanLines[1]) trainer = cleanLines[1];
                    }

                    const btnText = btn.innerText.toUpperCase();
                    let status = 'Full';
                    if (btnText.includes('BOOK')) status = 'Open';
                    else if (btnText.includes('WAITLIST')) status = 'Waitlist';

                    results.push({
                        gym_slug: '1rebel',
                        date: currentDateStr,
                        time: timeFound,
                        class_name: className,
                        location: location,
                        trainer: trainer,
                        status: status,
                        link: btn.href || 'https://www.1rebel.com/en-gb/reserve'
                    });
                }
            });
            
            return results;
        }, dateStr);

        if (dailyClasses.length > 0) {
            console.log(`   ✅ Found ${dailyClasses.length} classes.`);
            allClasses = allClasses.concat(dailyClasses);
        }
    }

    // Deduplication
    const uniqueClasses = [];
    const seen = new Set();
    allClasses.forEach(c => {
        const key = `${c.date}-${c.time}-${c.class_name}-${c.location}`;
        if (!seen.has(key)) { seen.add(key); uniqueClasses.push(c); }
    });

    console.log(`[1Rebel] Success! Found ${uniqueClasses.length} unique classes.`);
    return uniqueClasses;

  } catch (error) {
    console.error('[1Rebel] Error:', error);
    return [];
  } finally {
    if (page) await page.close();
  }
}