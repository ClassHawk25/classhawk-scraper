// scrapers/extractors/barrys.js
import fs from 'fs';

/**
 * Barry's Scraper v12: The Forensic Examiner
 * Debugs the specific data payload causing the DB constraint violation.
 */
function buildBarryUrls(initialUrl, daysToScrape = 7) {
  const results = [];
  const today = new Date();
  const baseUrl = "https://www.barrys.com/schedule/london-east/";

  for (let i = 0; i < daysToScrape; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    const dateString = nextDate.toISOString().split('T')[0];
    
    // Magic Path: Region 9790, Location 9834
    const magicPath = `/schedule/daily/9790?activeDate=${dateString}&locations=9834`;
    const finalUrl = `${baseUrl}?_mt=${encodeURIComponent(magicPath)}`;
    
    results.push({ url: finalUrl, date: dateString });
  }
  return results;
}

async function scrapeBarrys(browser, config) {
  const rawClasses = [];
  const urlsToScrape = buildBarryUrls(config.url, 7);

  console.log(`\n💪 Starting Barry's Scrape...`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  // --- SCRAPE LOOP ---
  for (const item of urlsToScrape) {
    const { url, date } = item;
    console.log(`   → Scraping: ${date} ...`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // 1. CLICK COOKIE BUTTON
      try {
        const cookieBtn = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          return buttons.find(b => b.innerText.toUpperCase().includes('ACCEPT ALL'));
        });
        if (cookieBtn) { await cookieBtn.click(); await new Promise(r => setTimeout(r, 500)); }
      } catch(e) { /* ignore */ }

      // 2. FIND FRAME
      let targetFrame = null;
      await new Promise(r => setTimeout(r, 4000));
      const frames = page.frames();

      for (const frame of frames) {
         if (frame.url().includes('marianaiframes.com') || frame.url().includes('schedule/daily')) {
             targetFrame = frame;
             break;
         }
      }
      if (!targetFrame) targetFrame = page;

      // 3. WAIT FOR DATA
      try {
        await targetFrame.waitForSelector('tr[data-test-row="table-row"]', { timeout: 8000 });
      } catch (e) { }

      // 4. EXTRACT DATA
      const result = await targetFrame.evaluate((targetDate) => {
        const data = [];
        const rows = Array.from(document.querySelectorAll('tr[data-test-row="table-row"]'));

        rows.forEach((row) => {
            try {
                const timeCell = row.querySelector('td'); 
                const timeText = timeCell ? timeCell.innerText.trim() : '';
                
                // Matches "7:10", "07:10", "10:00"
                const timeMatch = timeText.match(/(\d{1,2}:\d{2})/); 
                const time = timeMatch ? timeMatch[0] : null;

                if (!time) return; 

                let className = "Barry's Class";
                const classBtn = row.querySelector('[data-test-button*="class-details"]');
                if (classBtn) className = classBtn.innerText.trim();
                
                let trainer = "Instructor";
                const instrBtn = row.querySelector('[data-test-button*="instructor-details"]');
                if (instrBtn) trainer = instrBtn.innerText.trim();

                let status = 'Full';
                let link = null;
                const resBtn = row.querySelector('[data-test-button*="reserve"]');
                
                if (resBtn) {
                    const btnText = resBtn.innerText.toUpperCase();
                    link = resBtn.href;
                    if (btnText.includes('RESERVE') || btnText.includes('BOOK')) status = 'Open';
                    else if (btnText.includes('WAITLIST')) status = 'Waitlist';
                } else if (row.innerText.toUpperCase().includes('FULL')) {
                    status = 'Full';
                }

                if (!link) link = 'https://www.barrys.com/schedule/london-east/';

                data.push({
                    gym_slug: 'barrys',
                    class_name: className,
                    trainer: trainer,
                    location: "London East",
                    date: targetDate,
                    time: time, 
                    status: status,
                    link: link
                });

            } catch (err) {}
        });
        return data;
      }, date);

      if (result.length > 0) {
        console.log(`     ✅ Found ${result.length} classes.`);
        rawClasses.push(...result);
      } else {
        console.log(`     ⚠️ No classes found.`);
      }

    } catch (err) { 
        console.error(`     ❌ Error scraping ${date}: ${err.message}`); 
    }
  }

  await page.close();

  // --- 5. SANITIZATION & FORENSICS ---
  console.log("\n🕵️‍♂️ RUNNING FORENSIC CHECK...");
  
  const cleanClasses = rawClasses.filter(c => {
      if (!c.time) {
          console.log("     ❌ DISCARDING INVALID CLASS (No Time):", c);
          return false;
      }
      return true;
  }).map(c => {
      // Ensure Time is strictly HH:MM
      let cleanTime = c.time.trim();
      
      // Fix "7:30" -> "07:30"
      if (/^\d:\d{2}$/.test(cleanTime)) {
          cleanTime = "0" + cleanTime;
      }

      return {
          ...c,
          time: cleanTime
      };
  });

  // LOG THE FINAL DATA DUMP
  // This will show us EXACTLY what is being sent to Supabase
  console.log("\n📦 FINAL PAYLOAD SAMPLE (First 3 items):");
  console.log(JSON.stringify(cleanClasses.slice(0, 3), null, 2));

  console.log(`\n✨ Total Valid Classes: ${cleanClasses.length}`);
  return cleanClasses;
}

export default scrapeBarrys;