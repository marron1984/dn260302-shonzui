const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const HTML_PATH = path.resolve(__dirname, 'index.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const WEBM_PATH = path.join(OUTPUT_DIR, 'reel-raw.webm');
const MP4_PATH = path.join(OUTPUT_DIR, 'shikon-course-reel.mp4');

const TOTAL_DURATION = 25500;
const BUFFER = 2000;

// ===== Image URL → Slide theme mapping =====
const IMAGE_THEMES = {
  '91a17503-59ca-483d-9504-bdc4bac2975e': {
    name: 'hook',
    colors: ['#3a2520', '#2a1815', '#1a0e0a', '#c9a84c'],
    accent: '#c9a84c',
    pattern: 'kaiseki',
  },
  '3334185c-7a89-4a39-b85e-46d3e4567b56': {
    name: 'course-info',
    colors: ['#2d1f35', '#1f1528', '#120e1a', '#8b6fb0'],
    accent: '#8b6fb0',
    pattern: 'fabric',
  },
  'db349c65-7277-4948-9782-e8fbc4575b36': {
    name: 'zensai',
    colors: ['#2a3520', '#1e2818', '#131a0e', '#8db870'],
    accent: '#8db870',
    pattern: 'plate',
  },
  'db6d710d-656f-4b8c-9be2-6d6a4dcebbba': {
    name: 'tsukuri',
    colors: ['#1a2535', '#111a28', '#0a1018', '#6a9dc8'],
    accent: '#6a9dc8',
    pattern: 'sashimi',
  },
  '19e439af-c253-4412-93fa-37a9f2f40658': {
    name: 'yakimono',
    colors: ['#3a2a18', '#2a1e10', '#1a1208', '#d4a050'],
    accent: '#d4a050',
    pattern: 'grill',
  },
  '5473b196-d636-404b-bf85-48c18fdf2af9': {
    name: 'agemono',
    colors: ['#351a18', '#281210', '#1a0c08', '#c87050'],
    accent: '#c87050',
    pattern: 'steam',
  },
  'fd0661ef-1bfc-42d8-894c-2f8e560210ff': {
    name: 'shiage',
    colors: ['#2a2520', '#1e1a15', '#12100a', '#d4c4a0'],
    accent: '#d4c4a0',
    pattern: 'rice',
  },
  '5a453e6b-d7f4-40d5-9015-c25c953245b0': {
    name: 'kanmi',
    colors: ['#352025', '#28151a', '#1a0e12', '#e0a0b0'],
    accent: '#e0a0b0',
    pattern: 'dessert',
  },
};

// ===== Canvas image generation function (run in browser context) =====
function generateImageScript(theme) {
  return `
    (() => {
      const W = 1080, H = 1920;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');

      const colors = ${JSON.stringify(theme.colors)};
      const accent = '${theme.accent}';
      const pattern = '${theme.pattern}';

      // Base gradient
      const bg = ctx.createRadialGradient(W*0.5, H*0.45, 100, W*0.5, H*0.5, H*0.7);
      bg.addColorStop(0, colors[0]);
      bg.addColorStop(0.4, colors[1]);
      bg.addColorStop(1, colors[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Warm light pool in center
      const light = ctx.createRadialGradient(W*0.5, H*0.42, 0, W*0.5, H*0.42, 420);
      light.addColorStop(0, colors[0] + 'cc');
      light.addColorStop(0.5, colors[0] + '44');
      light.addColorStop(1, 'transparent');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, W, H);

      // Subtle bokeh circles
      const seed = '${theme.name}'.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
      function pseudoRandom(i) {
        const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
        return x - Math.floor(x);
      }

      for (let i = 0; i < 12; i++) {
        const x = pseudoRandom(i * 3) * W;
        const y = pseudoRandom(i * 3 + 1) * H;
        const r = 30 + pseudoRandom(i * 3 + 2) * 80;
        const bk = ctx.createRadialGradient(x, y, 0, x, y, r);
        bk.addColorStop(0, accent + '18');
        bk.addColorStop(0.6, accent + '08');
        bk.addColorStop(1, 'transparent');
        ctx.fillStyle = bk;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central plate/dish motif
      if (pattern !== 'fabric') {
        const plateY = H * 0.4;
        const plateR = 280;

        // Shadow under plate
        const shadow = ctx.createRadialGradient(W*0.5, plateY + 30, plateR * 0.3, W*0.5, plateY + 30, plateR * 1.3);
        shadow.addColorStop(0, 'rgba(0,0,0,0.4)');
        shadow.addColorStop(1, 'transparent');
        ctx.fillStyle = shadow;
        ctx.fillRect(0, 0, W, H);

        // Plate rim
        ctx.beginPath();
        ctx.ellipse(W*0.5, plateY, plateR, plateR * 0.85, 0, 0, Math.PI * 2);
        const plateGrad = ctx.createRadialGradient(W*0.5, plateY - 40, 0, W*0.5, plateY, plateR);
        plateGrad.addColorStop(0, '#f8f4ee');
        plateGrad.addColorStop(0.7, '#e8e0d4');
        plateGrad.addColorStop(0.85, '#d8cfc0');
        plateGrad.addColorStop(1, '#c0b5a5');
        ctx.fillStyle = plateGrad;
        ctx.fill();

        // Inner plate
        ctx.beginPath();
        ctx.ellipse(W*0.5, plateY, plateR * 0.85, plateR * 0.72, 0, 0, Math.PI * 2);
        const innerGrad = ctx.createRadialGradient(W*0.5, plateY - 20, 0, W*0.5, plateY, plateR * 0.85);
        innerGrad.addColorStop(0, '#faf7f2');
        innerGrad.addColorStop(1, '#f0ebe2');
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Food elements on plate (vary by pattern)
        if (pattern === 'kaiseki' || pattern === 'plate') {
          // Garnish circles
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI * 0.5;
            const dist = 80 + pseudoRandom(i + 20) * 80;
            const fx = W*0.5 + Math.cos(angle) * dist;
            const fy = plateY + Math.sin(angle) * dist * 0.7;
            const fr = 25 + pseudoRandom(i + 30) * 30;

            ctx.beginPath();
            ctx.arc(fx, fy, fr, 0, Math.PI * 2);
            const foodGrad = ctx.createRadialGradient(fx - 5, fy - 5, 0, fx, fy, fr);
            foodGrad.addColorStop(0, accent + 'dd');
            foodGrad.addColorStop(0.7, accent + 'aa');
            foodGrad.addColorStop(1, accent + '66');
            ctx.fillStyle = foodGrad;
            ctx.fill();
          }
        } else if (pattern === 'sashimi') {
          // Sashimi slices
          for (let i = 0; i < 6; i++) {
            const sx = W*0.5 - 100 + i * 40;
            const sy = plateY - 30 + (i % 2) * 20;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(-0.2 + pseudoRandom(i + 40) * 0.4);
            const sliceGrad = ctx.createLinearGradient(-25, -8, 25, 8);
            sliceGrad.addColorStop(0, '#ff8a8a');
            sliceGrad.addColorStop(0.3, '#e06060');
            sliceGrad.addColorStop(0.6, '#ff9090');
            sliceGrad.addColorStop(1, '#ffa5a5');
            ctx.fillStyle = sliceGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 35, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          // Wasabi
          ctx.beginPath();
          ctx.arc(W*0.5 + 120, plateY + 60, 18, 0, Math.PI * 2);
          ctx.fillStyle = '#7ab85e';
          ctx.fill();
          // Shiso leaf
          ctx.beginPath();
          ctx.ellipse(W*0.5 - 120, plateY - 40, 35, 20, -0.3, 0, Math.PI * 2);
          ctx.fillStyle = '#3a7a30';
          ctx.fill();
        } else if (pattern === 'grill') {
          // Gratin dish
          ctx.beginPath();
          ctx.ellipse(W*0.5, plateY, 160, 100, 0, 0, Math.PI * 2);
          const gratinGrad = ctx.createRadialGradient(W*0.5, plateY - 20, 0, W*0.5, plateY, 160);
          gratinGrad.addColorStop(0, '#f0d870');
          gratinGrad.addColorStop(0.4, '#d4a840');
          gratinGrad.addColorStop(0.8, '#c09030');
          gratinGrad.addColorStop(1, '#a07020');
          ctx.fillStyle = gratinGrad;
          ctx.fill();
          // Browned top marks
          for (let i = 0; i < 8; i++) {
            const bx = W*0.5 - 100 + pseudoRandom(i + 50) * 200;
            const by = plateY - 60 + pseudoRandom(i + 60) * 80;
            ctx.beginPath();
            ctx.ellipse(bx, by, 20, 10, pseudoRandom(i+70), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(139, 90, 30, 0.5)';
            ctx.fill();
          }
        } else if (pattern === 'steam') {
          // Spring rolls + croquettes
          for (let i = 0; i < 3; i++) {
            const rx = W*0.5 - 80 + i * 80;
            const ry = plateY - 20;
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(-0.2 + i * 0.2);
            // spring roll
            const rollGrad = ctx.createLinearGradient(-30, -12, 30, 12);
            rollGrad.addColorStop(0, '#d4a050');
            rollGrad.addColorStop(0.5, '#c89040');
            rollGrad.addColorStop(1, '#b88030');
            ctx.fillStyle = rollGrad;
            ctx.beginPath();
            ctx.roundRect(-35, -14, 70, 28, 12);
            ctx.fill();
            ctx.restore();
          }
          // Steam effect
          ctx.globalAlpha = 0.15;
          for (let i = 0; i < 5; i++) {
            const sx = W*0.5 - 80 + pseudoRandom(i + 80) * 160;
            const sy = plateY - 100 - pseudoRandom(i + 90) * 100;
            const sr = 30 + pseudoRandom(i + 100) * 40;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (pattern === 'rice') {
          // Donabe (clay pot) shape
          ctx.beginPath();
          ctx.ellipse(W*0.5, plateY + 20, 180, 120, 0, 0, Math.PI * 2);
          const potGrad = ctx.createRadialGradient(W*0.5, plateY, 0, W*0.5, plateY + 20, 180);
          potGrad.addColorStop(0, '#f8f0e0');
          potGrad.addColorStop(0.5, '#f0e8d0');
          potGrad.addColorStop(1, '#d0c0a0');
          ctx.fillStyle = potGrad;
          ctx.fill();
          // Rice texture
          ctx.fillStyle = '#f5f0e5';
          for (let i = 0; i < 30; i++) {
            const rx = W*0.5 - 120 + pseudoRandom(i + 110) * 240;
            const ry = plateY - 40 + pseudoRandom(i + 120) * 80;
            ctx.beginPath();
            ctx.ellipse(rx, ry, 6, 3, pseudoRandom(i+130) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
          // Fish flakes on top
          ctx.fillStyle = '#e8a080';
          for (let i = 0; i < 5; i++) {
            const fx = W*0.5 - 60 + pseudoRandom(i + 140) * 120;
            const fy = plateY - 20 + pseudoRandom(i + 150) * 40;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 20, 8, pseudoRandom(i+160) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (pattern === 'dessert') {
          // Panna cotta
          ctx.beginPath();
          ctx.ellipse(W*0.5, plateY, 100, 70, 0, 0, Math.PI * 2);
          const pannaGrad = ctx.createRadialGradient(W*0.5, plateY - 15, 0, W*0.5, plateY, 100);
          pannaGrad.addColorStop(0, '#fff5f0');
          pannaGrad.addColorStop(0.6, '#ffe8e0');
          pannaGrad.addColorStop(1, '#ffd5c8');
          ctx.fillStyle = pannaGrad;
          ctx.fill();
          // Sakura petal decoration
          for (let i = 0; i < 3; i++) {
            const px = W*0.5 - 40 + i * 40;
            const py = plateY - 30 + pseudoRandom(i + 170) * 20;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(pseudoRandom(i + 180) * Math.PI);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffb0c0';
            ctx.fill();
            ctx.restore();
          }
          // Sauce drizzle
          ctx.strokeStyle = '#c04060';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(W*0.5 - 80, plateY + 40);
          ctx.bezierCurveTo(W*0.5 - 40, plateY + 20, W*0.5 + 40, plateY + 50, W*0.5 + 80, plateY + 30);
          ctx.stroke();
        }
      }

      // Vignette overlay
      const vig = ctx.createRadialGradient(W*0.5, H*0.45, H*0.2, W*0.5, H*0.5, H*0.8);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // Subtle noise texture
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (pseudoRandom(i / 4) - 0.5) * 12;
        data[i]     = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      return c.toDataURL('image/jpeg', 0.92);
    })()
  `;
}

(async () => {
  console.log('Starting Instagram Reel video recording...');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ===== Pre-generate images in a separate (non-recording) context =====
  console.log('Generating food images with Canvas API...');
  const utilContext = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const utilPage = await utilContext.newPage();
  await utilPage.setContent('<html><body></body></html>');

  const imageCache = {};
  for (const [uuid, theme] of Object.entries(IMAGE_THEMES)) {
    const dataUrl = await utilPage.evaluate(generateImageScript(theme));
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    imageCache[uuid] = Buffer.from(base64, 'base64');
    console.log(`  Generated: ${theme.name} (${(imageCache[uuid].length / 1024).toFixed(0)} KB)`);
  }
  await utilContext.close();

  // ===== Recording context =====
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1080, height: 1920 },
    },
  });

  const page = await context.newPage();

  // ===== Intercept GitHub image requests =====
  await page.route('**/user-attachments/assets/**', async (route) => {
    const url = route.request().url();
    // Extract UUID from URL
    const match = url.match(/assets\/([a-f0-9-]+)/);
    if (match && imageCache[match[1]]) {
      console.log(`  Intercepted: ${match[1].substring(0, 8)}... → serving generated image`);
      await route.fulfill({
        contentType: 'image/jpeg',
        body: imageCache[match[1]],
      });
    } else {
      await route.fallback();
    }
  });

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
