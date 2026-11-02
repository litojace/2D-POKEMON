// Playwright for the prototype test scripts. Uses whatever "playwright" package Node finds (the repo's own);
// if that version's browser is not downloaded, it falls back to PW_CHROMIUM or the Chromium on the cloud dev box.
const pw = require('playwright'); const fs = require('fs');
const has = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const fallback = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium'].find(has);
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = (o = {}) => launch(!o.executablePath && !has(pw.chromium.executablePath()) && fallback ? { ...o, executablePath: fallback } : o);
module.exports = pw;
