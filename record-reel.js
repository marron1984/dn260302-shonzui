const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HTML_PATH = path.resolve(__dirname, 'index.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const WEBM_PATH = path.join(OUTPUT_DIR, 'reel-raw.webm');
const MP4_RAW_PATH = path.join(OUTPUT_DIR, 'reel-raw.mp4');
const MP4_PATH = path.join(OUTPUT_DIR, 'shikon-course-reel.mp4');

// 11 slides: hook(3) + course(3) + 7 courses(2.5 each) + reservation(3) + CTA(4.2) = 31.2s
const TOTAL_DURATION = 31200;
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

  // Record the time when video recording starts (context creation)
  const recordingStartTime = Date.now();

  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1080, height: 1920 },
    },
  });

  const page = await context.newPage();

  console.log('Loading HTML page...');
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);
  console.log('Fonts loaded.');

  // Wait for all images to be preloaded
  await page.waitForFunction(() => window.__REEL_READY__ === true, { timeout: 15000 });
  console.log('Images preloaded.');

  // Small settle time for rendering
  await page.waitForTimeout(300);

  // Measure pre-roll duration (from recording start to reel start)
  const preRollSeconds = (Date.now() - recordingStartTime) / 1000;
  console.log(`Pre-roll duration: ${preRollSeconds.toFixed(2)}s (will be trimmed)`);

  // Start the reel animation
  console.log('Triggering reel start...');
  await page.evaluate(() => window.startReel());

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

  // Convert WebM to MP4, trimming the pre-roll blank period
  // Add 0.2s margin to the trim point to account for render delay
  const trimPoint = Math.max(0, preRollSeconds - 0.2);
  console.log(`Trimming first ${trimPoint.toFixed(2)}s and converting to MP4...`);

  try {
    execSync(
      `ffmpeg -y -ss ${trimPoint.toFixed(3)} -i "${WEBM_PATH}" -t ${((TOTAL_DURATION + BUFFER) / 1000 + 0.5).toFixed(1)} -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart -vf "scale=1080:1920" "${MP4_PATH}"`,
      { stdio: 'inherit', timeout: 300000 }
    );
    console.log(`\nMP4 saved to: ${MP4_PATH}`);
    const stats = fs.statSync(MP4_PATH);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('FFmpeg conversion failed:', err.message);
    console.log(`WebM file is still available at: ${WEBM_PATH}`);
  }

  // Clean up WebM
  if (fs.existsSync(WEBM_PATH)) {
    fs.unlinkSync(WEBM_PATH);
  }
  if (fs.existsSync(MP4_RAW_PATH)) {
    fs.unlinkSync(MP4_RAW_PATH);
  }
})();
