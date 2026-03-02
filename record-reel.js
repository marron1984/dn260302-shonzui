const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HTML_PATH = path.resolve(__dirname, 'index.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const WEBM_PATH = path.join(OUTPUT_DIR, 'reel-raw.webm');
const MP4_PATH = path.join(OUTPUT_DIR, 'shikon-course-reel.mp4');

// 10 slides: hook(3) + course(3) + 7 courses(2.5 each) + CTA(4.2) = 28.2s
const TOTAL_DURATION = 28200;
const BUFFER = 2000;

(async () => {
  console.log('Starting Instagram Reel video recording...');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1080, height: 1920 },
    },
  });

  const page = await context.newPage();

  console.log('Loading HTML page...');
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });

  await page.evaluate(() => document.fonts.ready);
  console.log('Fonts loaded.');

  await page.waitForTimeout(500);

  console.log(`Recording for ${(TOTAL_DURATION + BUFFER) / 1000} seconds...`);
  await page.waitForTimeout(TOTAL_DURATION + BUFFER);

  console.log('Recording complete. Closing browser...');

  await page.close();
  await context.close();
  await browser.close();

  // Find recorded webm
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    console.error('No video file found!');
    process.exit(1);
  }

  const recordedFile = path.join(OUTPUT_DIR, files[files.length - 1]);
  console.log(`Recorded file: ${recordedFile}`);

  if (recordedFile !== WEBM_PATH) {
    fs.renameSync(recordedFile, WEBM_PATH);
  }

  // Convert to MP4
  console.log('Converting to MP4...');
  try {
    execSync(
      `ffmpeg -y -i "${WEBM_PATH}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -vf "scale=1080:1920" "${MP4_PATH}"`,
      { stdio: 'inherit', timeout: 120000 }
    );
    console.log(`\nMP4 saved to: ${MP4_PATH}`);
    const stats = fs.statSync(MP4_PATH);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('FFmpeg conversion failed:', err.message);
    console.log(`WebM file is still available at: ${WEBM_PATH}`);
  }
})();
