// Build: parse lesson + native sources, validate every Lua identifier against the official native list, inline into the page.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const idx = require(path.join(ROOT, 'data', 'idx.json'));
const generateResource = require(path.join(D, 'gen.js'));

// ---------- mini markdown ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  // keep <kbd> tags authored in the source
  s = esc(s).replace(/&lt;(\/?)kbd&gt;/g, '<$1kbd>');
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
  return s;
}
function mdBlocks(text) {
  const out = [];
  const blocks = text.split(/\n\s*\n/).map(b => b.replace(/^\n+|\n+$/g, '')).filter(Boolean);
  for (const b of blocks) {
    const lines = b.split('\n');
    if (lines.every(l => /^- /.test(l))) out.push('<ul>' + lines.map(l => '<li>' + inline(l.slice(2)) + '</li>').join('') + '</ul>');
    else if (lines.every(l => /^\d+\. /.test(l))) out.push('<ol>' + lines.map(l => '<li>' + inline(l.replace(/^\d+\. /, '')) + '</li>').join('') + '</ol>');
    else if (/^!! /.test(b)) out.push('<div class="callout warn"><span class="callout-tag">warning</span><p>' + inline(b.slice(3).replace(/\n/g, ' ')) + '</p></div>');
    else if (/^! /.test(b)) out.push('<div class="callout"><span class="callout-tag">note</span><p>' + inline(b.slice(2).replace(/\n/g, ' ')) + '</p></div>');
    else if (lines.every(l => /^\|/.test(l))) {
      const rows = lines.filter(l => !/^\|\s*-/.test(l)).map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      out.push('<div class="table-wrap"><table><thead><tr>' + rows[0].map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
    }
    else if (/^</.test(b)) out.push(b);
    else out.push('<p>' + inline(lines.join(' ')) + '</p>');
  }
  return out.join('\n');
}
// body -> parts [{t:'html',h}, {t:'code',lang,file,code}]
function parseBody(body) {
  const parts = [];
  const lines = body.split('\n');
  let buf = [], i = 0;
  const flush = () => { const t = buf.join('\n').trim(); if (t) parts.push({ t: 'html', h: mdBlocks(t) }); buf = []; };
  while (i < lines.length) {
    const m = lines[i].match(/^```(\w+)(?:\s+file=(.+))?\s*$/);
    if (m) {
      flush();
      const code = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      parts.push({ t: 'code', lang: m[1], file: (m[2] || '').trim(), code: code.join('\n') });
    } else buf.push(lines[i++]);
  }
  flush();
  return parts;
}

// ---------- lessons ----------
const src = ['lessons1.txt', 'lessons2.txt', 'lessons3.txt'].map(f => fs.readFileSync(path.join(D, f), 'utf8').replace(/\r/g, '')).join('\n');
const lessons = [];
for (const chunk of src.split(/^=== /m).filter(s => s.trim())) {
  const [head, ...rest] = chunk.split('\n');
  const [id, group, title, mins] = head.split('|').map(s => s.trim());
  const L = { id, group, title, mins: +mins, docs: [], sections: [], deeper: [], framework: null, task: null, quiz: [], summary: '' };
  const body = rest.join('\n');
  const pre = body.split(/^--- /m)[0];
  for (const l of pre.split('\n')) { const d = l.match(/^docs:\s*(.+?)\s*\|\s*(\S+)/); if (d) L.docs.push({ label: d[1], url: d[2] }); }
  for (const sec of body.split(/^--- /m).slice(1)) {
    const nl = sec.indexOf('\n');
    const h = sec.slice(0, nl).trim(); const content = sec.slice(nl + 1);
    const kind = h.split(' ')[0]; const name = h.slice(kind.length).trim();
    if (kind === 'summary') L.summary = inline(content.trim().replace(/\n/g, ' '));
    else if (kind === 'section') L.sections.push({ title: name, parts: parseBody(content) });
    else if (kind === 'deeper') L.deeper.push({ title: name, parts: parseBody(content) });
    else if (kind === 'framework') L.framework = parseBody(content);
    else if (kind === 'task') L.task = { title: name, parts: parseBody(content) };
    else if (kind === 'quiz') {
      let q = null;
      for (const line of content.split('\n')) {
        if (/^\? /.test(line)) { q = { q: inline(line.slice(2)), opts: [], why: '' }; L.quiz.push(q); }
        else if (/^[+-] /.test(line) && q) { if (line[0] === '+') q.answer = q.opts.length; q.opts.push(inline(line.slice(2))); }
        else if (/^> /.test(line) && q) q.why = inline(line.slice(2));
      }
    } else throw new Error('unknown section ' + kind + ' in ' + id);
  }
  for (const q of L.quiz) if (q.answer === undefined || !q.why) throw new Error('bad quiz in ' + id + ': ' + q.q);
  if (!L.task || L.quiz.length < 2 || !L.docs.length) throw new Error('incomplete lesson ' + id);
  lessons.push(L);
}

// ---------- natives ----------
const RUNTIME = new Set(['CreateThread', 'Wait', 'AddEventHandler', 'RegisterNetEvent', 'TriggerEvent', 'TriggerServerEvent', 'TriggerClientEvent',
  'TriggerLatentServerEvent', 'TriggerLatentClientEvent', 'SendNUIMessage', 'RegisterNUICallback', 'GetPlayers', 'GetPlayerIdentifiers', 'PerformHttpRequest',
  'Entity', 'Player', 'RemoveEventHandler', 'SetTimeout',
  // Enhanced voice natives documented in the Voice guide
  'CreateVoiceChannel', 'DeleteVoiceChannel', 'AddPlayerToVoiceChannel', 'RemovePlayerFromVoiceChannel', 'SetPlayerMutedInVoiceChannel', 'SetPlayerDeafInVoiceChannel']);
const LUA_STD = new Set(['print', 'type', 'tostring', 'tonumber', 'pairs', 'ipairs', 'setmetatable', 'getmetatable', 'require', 'load', 'assert', 'error', 'pcall', 'select', 'next', 'rawget', 'rawset', 'unpack', 'vector3', 'vector4', 'vector2', 'quat', 'exports']);
const nativeRows = [];
for (const line of fs.readFileSync(path.join(D, 'natives.txt'), 'utf8').replace(/\r/g, '').split('\n').filter(Boolean)) {
  if (line[0] === '@') {
    const [name, side, cat, desc, ex, url] = line.slice(1).split('|');
    nativeRows.push({ n: name, s: side, c: cat, d: desc, e: ex, u: url, rt: 1 });
  } else {
    const [name, cat, desc, ex] = line.split('|');
    const x = idx[name];
    if (!x) throw new Error('native not found: ' + name);
    const sig = {};
    for (const [k, v] of Object.entries(x.sig)) { const m = v.match(/^(\S+) \((.*)\)$/); sig[k] = m[1] + ' ' + name + '(' + m[2] + ')'; }
    nativeRows.push({ n: name, s: x.side, c: cat, d: desc, e: ex, u: 'https://docs.fivem.net/natives/?_' + x.hash, sig, up: x.name });
  }
}

// ---------- validation of Lua identifiers ----------
const problems = [];
function checkLua(code, where) {
  const defined = new Set();
  code.replace(/function\s+([A-Za-z_][\w.:]*)\s*\(/g, (m, n) => defined.add(n.split(/[.:]/).pop()));
  code.replace(/local\s+function\s+(\w+)/g, (m, n) => defined.add(n));
  code.replace(/local\s+(\w+)\s*=/g, (m, n) => defined.add(n));
  const stripped = code.replace(/--.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''");
  const re = /(^|[^.:\w])([A-Za-z_]\w*)\s*\(/g; let m;
  while ((m = re.exec(stripped))) {
    const n = m[2];
    if (['function', 'if', 'and', 'or', 'not', 'return', 'while', 'elseif', 'until', 'in'].includes(n)) continue;
    if (defined.has(n) || LUA_STD.has(n) || RUNTIME.has(n) || idx[n]) continue;
    problems.push(where + ': unknown function ' + n);
  }
}
for (const L of lessons) {
  const all = [...L.sections, ...L.deeper, L.task && { parts: L.task.parts }, L.framework && { parts: L.framework }].filter(Boolean);
  for (const s of all) for (const p of s.parts) if (p.t === 'code' && p.lang === 'lua') checkLua(p.code, L.id + ' / ' + (s.title || '') + ' / ' + p.file);
}
// inline-code mentions in prose like `GetNameOfZone` must also exist
for (const L of lessons) {
  const text = JSON.stringify(L);
  const re = /<code>([A-Z][A-Za-z0-9]+)(?:\(|<\/code>)/g; let m;
  while ((m = re.exec(text))) { const n = m[1]; if (!idx[n] && !RUNTIME.has(n) && !/^(Config|Entity|Player|LocalPlayer|GlobalState|Hash|Vector3|BaseScript|DRAW_|REGISTER_|GET_|REQUEST_)/.test(n)) problems.push(L.id + ': prose mentions ' + n); }
}
// generator: all 16 combinations
const combos = [];
for (let b = 0; b < 16; b++) {
  const o = { name: 'coffee_shop', author: 'Tester', description: 'x', config: !!(b & 1), nui: !!(b & 2), cooldown: !!(b & 4), marker: !!(b & 8) };
  const r = generateResource(o);
  combos.push({ o, r });
  for (const f of r.files) if (f.lang === 'lua') checkLua(f.content, 'gen' + b + '/' + f.path);
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'combos.json'), JSON.stringify(combos.map(c => ({ o: c.o, files: c.r.files })), null, 1));

console.log('lessons:', lessons.length, '| quiz questions:', lessons.reduce((a, l) => a + l.quiz.length, 0), '| natives:', nativeRows.length);
if (problems.length) { console.log('PROBLEMS:\n' + [...new Set(problems)].join('\n')); }

// ---------- assemble page ----------
const data = JSON.stringify({ lessons, natives: nativeRows }).replace(/</g, '\\u003c');
let html = fs.readFileSync(path.join(D, 'page.html'), 'utf8');
html = html.replace('/*@@DATA@@*/', () => 'window.GARAGE_DATA = ' + data + ';');
html = html.replace('/*@@GEN@@*/', () => fs.readFileSync(path.join(D, 'gen.js'), 'utf8').replace(/<\/script/g, '<\\/script'));
const page = html;
html = html.replace('/*@@APP@@*/', '');
fs.writeFileSync(path.join(OUT, 'fivem-script-garage.html'), html);
console.log('wrote', (html.length / 1024).toFixed(0) + 'KB');
// local preview copy with the same skeleton the artifact host adds
fs.writeFileSync(path.join(OUT, 'preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n' + html + '\n</body></html>');

// ---------- installable app (GitHub Pages) ----------
// The artifact host wraps the page in a skeleton; the app needs a real document, so build one the same way.
const SKELETON = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}';
const appPage = page.replace('/*@@APP@@*/', () => fs.readFileSync(path.join(D, 'app.js'), 'utf8'));
const split = appPage.indexOf('<div class="topbar">');
const headPart = appPage.slice(0, split).replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const app = [
  '<!doctype html>', '<html lang="en">', '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="description" content="Learn FiveM Lua scripting from the Cfx.re docs: 14 lessons with quizzes, a resource generator, a native cheat sheet and a backdoor scanner.">',
  '<meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#181613" media="(prefers-color-scheme: dark)">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Script Garage">',
  '<style>' + SKELETON + '</style>',
  headPart.trim(),
  '</head>', '<body>',
  appPage.slice(split).trim(),
  '</body>', '</html>', ''
].join('\n');
fs.writeFileSync(path.join(ROOT, 'index.html'), app);
const version = require('crypto').createHash('sha1').update(app).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sw.js'), fs.readFileSync(path.join(D, 'sw.js'), 'utf8').replace('__VERSION__', version));
console.log('app: index.html', (app.length / 1024).toFixed(0) + 'KB, offline cache fxsg-' + version);
