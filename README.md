# FiveM Script Garage

A study course for FiveM Lua scripting, built from the official Cfx.re docs (Scripting Manual, Secure Your Events, Native Reference).

- 14 lessons in docs order, each with client/server/manifest code, an in-game task and a quiz
- Resource generator (shared config, NUI menu, server cooldown, marker with "press E")
- Native cheat sheet (128 natives and runtime functions, client / server / both)
- Backdoor scanner for downloaded resources
- Installable app that works offline; progress codes move progress between devices

Live: https://404hxlo.github.io/fivem-script-garage/

## Layout

| Path | What it is |
| --- | --- |
| `src/lessons1-3.txt` | Lesson text, code and quizzes |
| `src/natives.txt` | Cheat sheet rows |
| `src/gen.js` | Resource generator |
| `src/page.html` | Page design and logic |
| `src/app.js`, `src/sw.js` | App-only code: install button and offline cache |
| `data/idx.json` | Native index used to check that every function in the lessons exists |
| `tools/build.js` | Builds `index.html` + `sw.js` (the app) and `dist/` (the claude.ai artifact) |
| `tools/syntax.js` | Parses every Lua block (needs `npm install` in `tools/`) |
| `tools/icons.js` | Renders `icons/` with headless Edge |
| `tools/serve.js` | Local server on port 4517 |

## Update

```bash
node tools/build.js
node tools/syntax.js
git commit -am "Describe the change"
git push origin main main:gh-pages
```

Then republish `dist/fivem-script-garage.html` to the artifact so both stay the same.
