import puppeteer from 'puppeteer';

async function findBsportId(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let companyId = null;

  page.on('request', req => {
    const reqUrl = req.url();
    const match = reqUrl.match(/company[=\/](\d+)/);
    if (match && reqUrl.includes('bsport')) {
      companyId = match[1];
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Also check page content for company ID
    if (!companyId) {
      const content = await page.content();
      const match = content.match(/company['":\s=\/]+(\d{3,6})/i);
      if (match) companyId = match[1];
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  await browser.close();
  return companyId;
}

const url = process.argv[2];
if (!url) {
  console.log('Usage: node utils/findBsportId.js <studio-url>');
  process.exit(1);
}

console.log(`Checking ${url}...`);
const id = await findBsportId(url);

if (id) {
  console.log(`\n✅ BSport Company ID: ${id}`);
  console.log(`\nAdd to configs.js:`);
  console.log(`{ name: 'StudioName', companyId: ${id} }`);
} else {
  console.log('\n❌ No BSport company ID found - studio may not use BSport');
}
