import puppeteer from 'puppeteer';

// Helper to clean up the title
const cleanTitle = (rawTitle) => {
  if (!rawTitle) return "";

  // 1. Remove Time at start (Matches "07:15" or "7:15")
  let cleaned = rawTitle.replace(/^\d{1,2}:\d{2}\s+/, '');

  // 2. Remove Duration and everything after
  const durationMatch = cleaned.match(/\s+\d+\s*(Mins|mins)/);
  if (durationMatch) {
      cleaned = cleaned.substring(0, durationMatch.index);
  }

  // 3. Title Case
  return cleaned.toLowerCase().split(' ').map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ').trim();
};

export default async function scrapeVirginActive(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });

  let masterList = [];
  const urls = config.locations || [config.url];

  const formatLocation = (url) => {
      if (url.includes('crouch-end')) return 'Crouch End';
      if (url.includes('angel')) return 'Angel';
      return 'Virgin Active';
  };

  const calculateDate = (dayIndex) => {
      const today = new Date();
      const target = new Date(today);
      target.setDate(today.getDate() + dayIndex);
      return target.toISOString().split('T')[0];
  };

  for (const url of urls) {
    console.log(`[Virgin Active] Navigating to: ${formatLocation(url)}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      try {
          const cookieBtn = await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 3000 });
          if (cookieBtn) await cookieBtn.click();
      } catch(e) {}

      try {
        await page.waitForFunction(() => document.body.innerText.includes('FILTER'), { timeout: 10000 });
      } catch(e) {}

      for (let i = 0; i < 7; i++) {
        const dateStr = calculateDate(i);
        
        const dailyClasses = await page.evaluate((currentDate) => {
           const results = [];
           // Select rows
           const cards = Array.from(document.querySelectorAll('div[class*="timetable"], div[class*="class-item"], .classes-list-item, tr'));

           cards.forEach(card => {
               const text = card.innerText; 
               if (!text.includes(':')) return;

               // 1. TIME CHECK
               const timeMatch = text.match(/(\d{2}:\d{2})/);
               const time = timeMatch ? timeMatch[0] : null;
               if (!time) return;

               // 2. STRICT TITLE CHECK (The Fix)
               // We ONLY accept this row if we find a dedicated title element.
               // We do NOT fall back to raw text.
               const titleEl = card.querySelector('h3, h4, strong, .class-name, [data-testid="class-name"]');
               
               if (!titleEl) return; // SKIP junk rows

               let title = titleEl.innerText.trim();
               
               // Filter out if title is just a time or empty
               if (title.length < 3 || title.includes('2025')) return;

               // 3. TRAINER CHECK
               let trainer = "Staff";
               const trainerEl = card.querySelector('.instructor, .teacher, .class-instructor');
               if (trainerEl) {
                   trainer = trainerEl.innerText.trim();
               } else {
                   const parts = text.split(/Mins|mins/);
                   if (parts.length > 1) {
                       let possibleName = parts[1].trim();
                       possibleName = possibleName.replace(/Book|Waitlist|Full|Join/gi, '').trim();
                       if(possibleName.length > 2 && possibleName.length < 30) trainer = possibleName;
                   }
               }

               let status = 'Open';
               if (text.toLowerCase().includes('waitlist') || text.toLowerCase().includes('full')) {
                   status = 'Waitlist';
               }

               results.push({
                   time,
                   title, 
                   trainer,
                   status,
                   link: window.location.href 
               });
           });
           return results;
        }, dateStr);

        if (dailyClasses.length > 0) {
            const cleaned = dailyClasses.map(c => ({
                gym_slug: 'virginactive',
                date: dateStr,
                time: c.time,
                class_name: cleanTitle(c.title),
                location: formatLocation(url),
                trainer: c.trainer,
                status: c.status,
                link: c.link
            }));
            
            masterList = masterList.concat(cleaned);
        }
      }
    } catch (err) {
      console.error(`   ❌ Error scraping ${url}: ${err.message}`);
    }
  }

  // Deduplicate
  const uniqueClasses = [];
  const seen = new Set();
  masterList.forEach(c => {
      const key = `${c.date}-${c.time}-${c.class_name}`;
      if (!seen.has(key)) {
          seen.add(key);
          uniqueClasses.push(c);
      }
  });

  console.log(`[Virgin Active] Success! Total Clean Count: ${uniqueClasses.length}`);
  return uniqueClasses;
}