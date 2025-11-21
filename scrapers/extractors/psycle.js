import puppeteer from 'puppeteer';

async function scrapePsycle(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  // Helper to make "shoreditch" look like "Shoreditch"
  const formatLocation = (url) => {
      try {
          const slug = url.split('/pages/')[1].replace('-timetable', '').replace('-', ' ');
          return slug.charAt(0).toUpperCase() + slug.slice(1);
      } catch (e) { return 'Psycle Studio'; }
  };

  for (const url of urls) {
      const locationName = formatLocation(url);
      console.log(`[Psycle] -----------------------------------`);
      console.log(`[Psycle] Navigating to: ${locationName} (${url})`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Close Cookie Banner
        try {
            const buttons = await page.$$('button, a');
            for (const b of buttons) {
                const t = await page.evaluate(el => el.innerText.toLowerCase(), b);
                if (t.includes('accept') || t.includes('agree') || t.includes('close')) {
                    await b.click();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch(e) {}

        // Wait for content
        try {
            await page.waitForFunction(
                () => document.body.innerText.includes('FILTER') || document.body.innerText.match(/\d{1,2}:\d{2}/),
                { timeout: 10000 }
            );
        } catch(e) {
            console.log(`[Psycle] No schedule found for ${locationName} - skipping.`);
            continue;
        }

        // --- CHANGE THIS NUMBER TO SCRAPE MORE DAYS ---
        const daysToScrape = 21; 
        // ---------------------------------------------

        for (let i = 0; i < daysToScrape; i++) {
            
            // Get Date
            const dateText = await page.evaluate(() => {
                const active = document.querySelector('.slick-current') || 
                               document.querySelector('.is-active') ||
                               document.querySelector('.date-header.active'); 
                return active ? active.innerText.replace(/\n/g, ' ') : null;
            });
            
            const currentDateLabel = dateText || `Day ${i+1}`;
            console.log(`[Psycle] ${locationName} - Day ${i+1}: ${currentDateLabel}`);

            // Scrape Classes
            const dailyClasses = await page.evaluate((dateLabel, locName) => {
                const results = [];
                const allDivs = Array.from(document.querySelectorAll('div'));
                
                // Find rows with Time + Dash
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

                        const isWaitlist = text.toLowerCase().includes('waitlist') || text.toLowerCase().includes('full');

                        if (title.length > 2) {
                            results.push({
                                gym: 'Psycle',
                                raw_date: dateLabel,
                                start_time: startTime,
                                class_name: title,
                                instructor: instructor,
                                location: locName, // Uses the pretty name now
                                status: isWaitlist ? 'Waitlist' : 'Open'
                            });
                        }
                    }
                });
                
                // Deduplicate inside the day
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

            }, currentDateLabel, locationName);

            masterList = masterList.concat(dailyClasses);

            // Click Next
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

            if (!clicked) {
                console.log(`[Psycle] End of schedule for ${locationName}.`);
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
      } catch(err) {
          console.log(`[Psycle] Error extracting ${url}: ${err.message}`);
      }
  }

  await page.close();
  
  // Global Deduplication
  const finalUnique = [];
  const finalSeen = new Set();
  masterList.forEach(c => {
      const key = `${c.location}-${c.raw_date}-${c.start_time}-${c.class_name}`;
      if (!finalSeen.has(key)) {
          finalSeen.add(key);
          finalUnique.push(c);
      }
  });

  console.log(`[Psycle] Success! Scraped ${urls.length} locations. Total Clean Count: ${finalUnique.length}`);
  return finalUnique;
}

export default scrapePsycle;