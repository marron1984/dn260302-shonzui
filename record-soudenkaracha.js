const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HTML_PATH = path.resolve(__dirname, 'soudenkaracha.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const WEBM_PATH = path.join(OUTPUT_DIR, 'soudenkaracha-raw.webm');
const MP4_PATH = path.join(OUTPUT_DIR, 'soudenkaracha-course-reel.mp4');

// 12 slides: hook(3) + course(3) + 8 courses(2.5×7 + 3) + reservation(3) + CTA(4.2) = 33.7s
const TOTAL_DURATION = 33700;
const BUFFER = 2000;

(async () => {
  console.log('Starting 宗伝唐茶コース Reel recording...');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

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

  await page.evaluate(() => document.fonts.ready);
  console.log('Fonts loaded.');

  await page.waitForFunction(() => window.__REEL_READY__ === true, { timeout: 15000 });
  console.log('Images preloaded.');

  await page.waitForTimeout(300);

  const preRollSeconds = (Date.now() - recordingStartTime) / 1000;
  console.log(`Pre-roll duration: ${preRollSeconds.toFixed(2)}s (will be trimmed)`);

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

  // Clean up
  if (fs.existsSync(WEBM_PATH)) {
    fs.unlinkSync(WEBM_PATH);
  }
})();
