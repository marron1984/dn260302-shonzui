const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HTML_PATH = path.resolve(__dirname, 'index.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const WEBM_PATH = path.join(OUTPUT_DIR, 'reel-raw.webm');
const MP4_PATH = path.join(OUTPUT_DIR, 'shikon-course-reel.mp4');

// Total animation duration (sum of all slide durations + buffer)
// 3000+3000+2500+2500+2500+2800+2500+2500+4200 = 25500ms
const TOTAL_DURATION = 25500;
const BUFFER = 2000; // Extra time for last slide to settle

(async () => {
  console.log('Starting Instagram Reel video recording...');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch browser with video recording
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

  // Navigate to the HTML file
  console.log('Loading HTML page...');
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  console.log('Fonts loaded.');

  // Wait a moment for initial animations to settle
  await page.waitForTimeout(500);

  // Wait for the full animation cycle
  console.log(`Recording for ${(TOTAL_DURATION + BUFFER) / 1000} seconds...`);
  await page.waitForTimeout(TOTAL_DURATION + BUFFER);

  console.log('Recording complete. Closing browser...');

  // Close page and context to finalize the video
  await page.close();
  await context.close();
  await browser.close();

  // Find the recorded webm file
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    console.error('No video file found!');
    process.exit(1);
  }

  const recordedFile = path.join(OUTPUT_DIR, files[files.length - 1]);
  console.log(`Recorded file: ${recordedFile}`);

  // Rename to expected path
  if (recordedFile !== WEBM_PATH) {
    fs.renameSync(recordedFile, WEBM_PATH);
  }

  // Convert to MP4 using system ffmpeg
  console.log('Converting to MP4...');

  try {
    execSync(
      `ffmpeg -y -i "${WEBM_PATH}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -vf "scale=1080:1920" "${MP4_PATH}"`,
      { stdio: 'inherit', timeout: 120000 }
    );
    console.log(`\nMP4 saved to: ${MP4_PATH}`);

    // Show file size
    const stats = fs.statSync(MP4_PATH);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('FFmpeg conversion failed:', err.message);
    console.log(`WebM file is still available at: ${WEBM_PATH}`);
  }
})();
