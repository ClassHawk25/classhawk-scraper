// scrapers/universalExtractor.js

export default async function universalExtractor(page, gym, date) {
  console.log(`Universal extractor running for ${gym.name}`);

  await page.goto(gym.url, { waitUntil: "networkidle2", timeout: 0 });

  await page.waitForSelector("body");

  const classes = await page.$$eval("div.grid.items-center", (items) =>
    items.map((el) => {
      const t = el.innerText.trim().split("\n");

      return {
        time: t.find((x) => /^\d{1,2}:\d{2}$/.test(x)) || null,
        class_name: t[1] || null,
        trainer: t[2] || null,
        location: t[t.length - 1] || null,
      };
    })
  );

  return classes;
}
