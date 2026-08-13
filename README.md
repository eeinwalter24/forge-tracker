# Forge

A calorie, workout, and body-composition tracker that runs entirely in your browser.
No account, no server, no build step — open `index.html` and it works, on a phone or a laptop.
Everything is stored in `localStorage` on that device, and Export writes a JSON backup.

**Live app: https://eeinwalter24.github.io/forge-tracker/**

The point of difference is the Coach tab. Most trackers show you numbers. This one takes what
you actually ate and what the scale actually did, solves energy balance backwards for your
*real* maintenance calories, and tells you the one or two things worth changing.

---

## What's in it

**Today** — calorie ring, macro bars, remaining budget, latest weigh-in and trend, today's
session, and the top two things the coach wants you to know.

**Food** — search across 127 built-in foods (whole foods, restaurant items, drinks, snacks),
scale any of them to any quantity, and define your own from a label. Foods you log often
surface as one-tap chips.

**Train** — three program templates (Upper/Lower 4-day, Full Body 3-day, PPL 5-day), a
55-exercise library, and a set logger that shows what you lifted last time on that exercise,
computes estimated 1RM live as you type, and stars any set that beats your best.

**Progress** — bodyweight chart with a 7-day average over the raw readings, rate of change in
lb/week, 8-week training volume, weekly hard sets per muscle against the 10–20 set range,
estimated 1RM on the main lifts, and tape measurements.

**Coach** — measured vs predicted maintenance calories, and a prioritized list of what to fix:
rate of loss drifting off target, protein falling short, gaps in logging, undertrained muscles,
lifts that have stalled, deficits that have run long enough to need a break.

## How the numbers work

Baseline energy expenditure uses Mifflin-St Jeor times an activity multiplier. That prediction
carries roughly ±10% error for any individual, so it's only a starting point.

Once you have about ten logged days, the Coach tab replaces it: given mean intake and the
regression slope of your smoothed weight over the same window, maintenance is
`mean intake − (weekly change ÷ 7 × 3500)`. That number comes from your own data and is the one
worth acting on.

Protein targets 1 g per lb of bodyweight while cutting, fat sits at a hormonal floor around
0.35 g/lb, and carbohydrate takes the remaining calories.

## Running it locally

```bash
open index.html                # or just double-click it

npx http-server . -p 8080      # nicer for testing on a phone over your LAN
```

### Storage, and why the origin matters

Your log lives in the browser's storage for the exact origin the page was served from. Data
written at `192.168.1.x:8080` is not visible at the `github.io` address, and neither is visible
to a copy opened off the filesystem. Pick one place to log and stay there; Export/Import moves
history between them.

The app probes storage at startup and shows a warning banner if writes aren't being kept, which
happens in sandboxed frames and some private-browsing modes.

## Development

```
index.html          markup and script order
assets/styles.css   theme tokens, layout, components (light + dark)
js/store.js         localStorage persistence, date helpers, accessors
js/nutrition.js     BMR/TDEE, calorie and macro targets, food scaling
js/foods.js         built-in food database + search and frequency ranking
js/workouts.js      exercise library, program templates, e1RM, volume analysis
js/charts.js        SVG line/bar/ring charts, moving average
js/coach.js         measured TDEE, weight trend regression, advice engine
js/views.js         DOM construction for the five tabs
js/app.js           routing, modals, onboarding, import/export
build.js            inlines everything into dist/ single-file copies
test/smoke.js       end-to-end browser test (Playwright)
```

No runtime dependencies and no toolchain — plain ES5-compatible scripts loaded in order, so
`index.html` works straight off the filesystem.

```bash
node build.js                  # writes dist/forge.html and dist/artifact.html

npx http-server . -p 8199 -s   # one shell — path first, before the flags
node test/smoke.js             # another; 41 checks across all five tabs
```

`build.js` asserts its output contains the sources byte-for-byte, which guards against the
inlining step mangling them — `String.replace` with a string replacement interprets `$&`, and
`foods.js` contains the regex-escape idiom `'\\$&'`.

---

*General fitness information, not medical advice. Worth a word with a doctor before starting a
new diet or training program, particularly with any existing condition or medication.*
