import puppeteer from 'puppeteer';

export default async function scrapePsycle(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  for (const url of urls) {
      console.log(`[Psycle] Navigating to: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        try { await page.waitForFunction(() => document.body.innerText.includes('FILTER'), { timeout: 10000 }); } catch(e) {}

        for (let i = 0; i < 5; i++) {
            const dateText = await page.evaluate(() => {
                const active = document.querySelector('.slick-current') || document.querySelector('.is-active'); 
                return active ? active.innerText.replace(/\n/g, ' ') : null;
            });
            const currentDateLabel = dateText || `Day ${i+1}`;
            console.log(`[Psycle] Scraping ${currentDateLabel}...`);

            const dailyClasses = await page.evaluate((dateLabel) => {
                const results = [];
                // Find row containers explicitly
                const allDivs = Array.from(document.querySelectorAll('div'));
                
                // Strict Filter: Must contain Time AND Dash AND be a row
                const classRows = allDivs.filter(div => {
                    const t = div.innerText;
                    return /\b\d{1,2}:\d{2}\b/.test(t) && t.includes('-') && t.length < 150 && !t.includes('FILTER');
                });

                classRows.forEach(row => {
                    const text = row.innerText; 
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    
                    // Line 1: "12:30 PM - RIDE: TAYLOR SWIFT"
                    const headerLine = lines[0];
                    const timeMatch = headerLine.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i);
                    
                    if (timeMatch) {
                        const startTime = timeMatch[0];
                        let title = headerLine.replace(startTime, '').replace(/^[-\s]+/, '').trim();
                        
                        let instructor = "Staff";
                        
                        // Line 2: "Riazul - Ride Studio" or just "Riazul"
                        if (lines.length > 1) {
                            const details = lines[1];
                            // Split by hyphen if it exists
                            if (details.includes(' - ')) {
                                instructor = details.split(' - ')[0].trim();
                            } else if (details.includes('-')) {
                                instructor = details.split('-')[0].trim();
                            } else {
                                instructor = details;
                            }
                        }

                        let link = null;
                        const btn = row.querySelector('a');
                        if (btn && btn.href) link = btn.href;

                        const isWaitlist = text.toLowerCase().includes('waitlist') || text.toLowerCase().includes('full');

                        if (title.length > 2) {
                            results.push({
                                gym: 'Psycle',
                                raw_date: dateLabel,
                                start_time: startTime,
                                class_name: title,
                                instructor: instructor,
                                location: 'See URL',
                                status: isWaitlist ? 'Waitlist' : 'Open',
                                link
                            });
                        }
                    }
                });
                // Dedupe immediately
                const unique = []; const seen = new Set();
                results.forEach(r => {
                    const key = r.start_time + r.class_name + r.instructor;
                    if(!seen.has(key)) { seen.add(key); unique.push(r); }
                });
                return unique;
            }, currentDateLabel);

            dailyClasses.forEach(c => { if (!c.link) c.link = url; });
            masterList = masterList.concat(dailyClasses);

            // Click Next
            const clicked = await page.evaluate(() => {
                const active = document.querySelector('.slick-current') || document.querySelector('.is-active');
                if (active && active.nextElementSibling) {
                    (active.nextElementSibling.querySelector('a, div') || active.nextElementSibling).click();
                    return true;
                }
                const arrow = document.querySelector('.slick-next');
                if (arrow) { arrow.click(); return true; }
                return false;
            });
            if (!clicked) break;
            await new Promise(r => setTimeout(r, 1500));
        }
      } catch(err) { console.log(`[Psycle] Error: ${err.message}`); }
  }
  await page.close();
  
  // Global Dedupe
  const finalUnique = []; const finalSeen = new Set();
  masterList.forEach(c => {
      // Fix Location Name
      let locName = 'Psycle Studio';
      if(c.link.includes('bank')) locName = 'Bank';
      if(c.link.includes('oxford')) locName = 'Oxford Circus';
      if(c.link.includes('shoreditch')) locName = 'Shoreditch';
      if(c.link.includes('notting')) locName = 'Notting Hill';
      if(c.link.includes('victoria')) locName = 'Victoria';
      c.location = locName;

      const key = `${c.raw_date}-${c.start_time}-${c.class_name}-${c.instructor}`;
      if (!finalSeen.has(key)) { finalSeen.add(key); finalUnique.push(c); }
  });
  console.log(`[Psycle] Success! Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}