/* Bundles the app into single self-contained files, so there is exactly one
   source of truth and the hosted copies can never drift from the repo.

     node build.js

   Produces:
     dist/forge.html      complete standalone document — host it anywhere, open
                          it off a USB stick, mail it to yourself
     dist/artifact.html   the same page as a fragment (no <html>/<head>/<body>),
                          which is the shape the Artifact publisher expects
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const css = read('assets/styles.css');

// Script order matters and index.html is the authority on it.
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('No <script src> tags found in index.html');

const js = scripts.map((src) => '/* ===== ' + src + ' ===== */\n' + read(src)).join('\n');

/* Inline CSS and JS in place, keeping everything else about the document.

   Every replacement passes a FUNCTION rather than a string. A string
   replacement would interpret `$&`, `$1` and friends inside the source being
   inlined — foods.js contains the regex-escape idiom `'\\$&'`, which a string
   replacement silently rewrites into the matched text. */
let standalone = html
  .replace(/<link rel="stylesheet" href="[^"]+">/, () => '<style>\n' + css + '\n</style>')
  .replace(/<script src="[^"]+"><\/script>\s*/g, () => '')
  .replace('</body>', () => '<script>\n' + js + '\n</script>\n</body>');

/* The Artifact publisher supplies its own document skeleton, so the fragment
   keeps <title> (it names the tab) but drops the wrapper tags and the favicon
   link, which the publisher sets from the favicon parameter instead. */
const body = standalone.match(/<body>([\s\S]*)<\/body>/)[1];
const title = standalone.match(/<title>([\s\S]*?)<\/title>/)[1];

const fragment = [
  '<title>' + title + '</title>',
  '<style>',
  css,
  '</style>',
  body.trim()
].join('\n');

/* Both outputs must contain the sources byte-for-byte. This is the guard
   against any future inlining step quietly mangling what it copies. */
for (const [name, out] of [['forge.html', standalone], ['artifact.html', fragment]]) {
  if (!out.includes(css)) throw new Error(name + ': stylesheet was altered during inlining');
  if (!out.includes(js)) throw new Error(name + ': scripts were altered during inlining');
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'forge.html'), standalone);
fs.writeFileSync(path.join(OUT, 'artifact.html'), fragment);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('bundled ' + scripts.length + ' scripts + stylesheet');
console.log('  dist/forge.html      ' + kb(standalone));
console.log('  dist/artifact.html   ' + kb(fragment));
