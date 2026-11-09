const { execSync } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetDir = 'C:\\Users\\ra416\\.gemini\\antigravity\\brain\\ae369e51-6e67-4ff5-bbc6-598e6e96c682';

const shots = [
  { url: 'http://localhost:8788/', name: 'polished_homepage_desktop.png', size: '1280,800' },
  { url: 'http://localhost:8788/', name: 'polished_homepage_mobile.png', size: '390,844' },
  { url: 'http://localhost:8788/company?id=google', name: 'polished_company_desktop.png', size: '1280,800' },
  { url: 'http://localhost:8788/quiz?company=google', name: 'polished_quiz_desktop.png', size: '1280,800' },
  { url: 'http://localhost:8788/quiz?company=google', name: 'polished_quiz_mobile.png', size: '390,844' }
];

for (const s of shots) {
  const outPath = path.join(targetDir, s.name);
  const cmd = `"${chromePath}" --headless=new --disable-gpu --virtual-time-budget=2000 --window-size=${s.size} --screenshot="${outPath}" "${s.url}"`;
  console.log(`Capturing ${s.name}...`);
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`  ✓ Saved ${s.name}`);
  } catch (e) {
    console.error(`  ✗ Error capturing ${s.name}:`, e.message);
  }
}

