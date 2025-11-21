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

        try {
            const buttons = await page.$$('button, a');
            for (const b of buttons) {
                const t = await page.evaluate(el => el.innerText.toLowerCase(), b);
                if (t.includes('accept') || t.includes('close')) await b.click();
            }
        } catch(e) {}

        try {
            await page.waitForFunction(
                () => document.body.innerText.includes('FILTER') || document.body.innerText.match(/\d{1,2}:\d{2}/),
                { timeout: 10000 }
            );
        } catch(e) { continue; }

        for (let i = 0; i < 5; i++) {
            const dateText = await page.evaluate(() => {
                const active = document.querySelector('.slick-current') || document.querySelector('.is-active'); 
                return active ? active.innerText.replace(/\n/g, ' ') : null;
            });
            
            const currentDateLabel = dateText || `Day ${i+1}`;
            console.log(`[Psycle] Scraping ${currentDateLabel}...`);

            const dailyClasses = await page.evaluate((dateLabel) => {
                const results = [];
                const allDivs = Array.from(document.querySelectorAll('div'));
                const classRows = allDivs.filter(div => {
                    const t = div.innerText;
                    return /\b\d{1,2}:\d{2}\b/.test(t) && t.includes('-') && t.length < 200 && !t.includes('FILTER');
                });

                classRows.forEach(row => {
                    const text = row.innerText; 
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    const headerLine = lines[0];
                    const timeMatch = headerLine.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i);
                    
                    if (timeMatch) {
                        const startTime = timeMatch[0];
                        let title = headerLine.replace(startTime, '').replace(/^[-\s]+/, '').trim();
                        
                        let instructor = "Staff";
                        if (lines.length > 1) {
                            const details = lines[1];
                            instructor = details.includes('-') ? details.split('-')[0].trim() : details;
                        }

                        // Try to find a specific link button
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
                                link: link // <--- Specific Link
                            });
                        }
                    }
                });
                
                const unique = [];
                const seen = new Set();
                results.forEach(r => {
                    const key = r.start_time + r.class_name + r.instructor;
                    if(!seen.has(key)) {
                        seen.add(key);
                        unique.push(r);
                    }
                });
                return unique;

            }, currentDateLabel);

            // Fill fallback links if specific one wasn't found
            dailyClasses.forEach(c => {
                if (!c.link) c.link = url; // Use the location URL as fallback
            });

            masterList = masterList.concat(dailyClasses);

            const clicked = await page.evaluate(() => {
                const active = document.querySelector('.slick-current') || document.querySelector('.is-active');
                if (active && active.nextElementSibling) {
                    const nextLink = active.nextElementSibling.querySelector('a, div');
                    (nextLink || active.nextElementSibling).click();
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
  
  const finalUnique = [];
  const finalSeen = new Set();
  masterList.forEach(c => {
      // Fix location name based on URL
      let locName = 'Psycle Studio';
      if(c.link && c.link.includes('bank')) locName = 'Bank';
      if(c.link && c.link.includes('oxford')) locName = 'Oxford Circus';
      if(c.link && c.link.includes('shoreditch')) locName = 'Shoreditch';
      if(c.link && c.link.includes('notting')) locName = 'Notting Hill';
      if(c.link && c.link.includes('victoria')) locName = 'Victoria';
      c.location = locName;

      const key = `${c.raw_date}-${c.start_time}-${c.class_name}-${c.instructor}`;
      if (!finalSeen.has(key)) {
          finalSeen.add(key);
          finalUnique.push(c);
      }
  });

  console.log(`[Psycle] Success! Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}