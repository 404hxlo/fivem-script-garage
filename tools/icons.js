// Renders the app icons with headless Edge. Run: node tools/icons.js
// The mark is a console prompt ( >_ ) in dispatch amber on the app's warm dark panel colour.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) throw new Error('Microsoft Edge not found');
const OUT = path.join(__dirname, '..', 'icons');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fxsg-icons-'));

function svg({ rounded, scale }) {
  // glyph drawn around the centre so it can shrink into the maskable safe zone
  const s = scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 104 : 0}" fill="#181613"/>
  ${rounded ? '<rect x="10" y="10" width="492" height="492" rx="96" fill="none" stroke="#38322b" stroke-width="4"/>' : ''}
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <polyline points="140,170 246,256 140,342" fill="none" stroke="#e9a33b" stroke-width="48" stroke-linecap="square" stroke-linejoin="miter"/>
    <rect x="276" y="304" width="112" height="42" fill="#ece6dc"/>
  </g>
</svg>`;
}

const jobs = [
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-32.png', size: 32, rounded: true, scale: 1.15 },
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.85 }
];

fs.mkdirSync(OUT, { recursive: true });
for (const j of jobs) {
  const html = path.join(TMP, j.file + '.html');
  fs.writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${j.size}px;height:${j.size}px}</style></head><body>${svg(j)}</body></html>`);
  const png = path.join(OUT, j.file);
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + path.join(TMP, 'profile'),
    '--default-background-color=00000000', '--force-device-scale-factor=1', `--window-size=${j.size},${j.size}`, '--screenshot=' + png, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  const b = fs.readFileSync(png);
  console.log(j.file, b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
}
fs.rmSync(TMP, { recursive: true, force: true });
