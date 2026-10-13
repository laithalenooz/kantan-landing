/**
 * Renders `og.html` to `og.png` at exactly 1200x630.
 *
 *   bun run og
 *
 * Its own page rather than a crop of the landing hero: a crop of a responsive
 * layout lands somewhere different whenever the type scale changes, and a
 * social card with the headline cut in half is worse than no card. The size is
 * the one every platform agrees on, and `og:image:width/height` in the page
 * declare it so a crawler does not have to fetch the file to lay the card out.
 */

const out = "og.png"
/* Written beside the source and copied into `public/` by the build, so the
   card survives a `rm -rf public` and does not need Chrome on every deploy. */
const page = `file://${import.meta.dir}/og.html`

const chrome = Bun.spawn(
  [
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--window-size=1200,630",
    `--screenshot=${import.meta.dir}/${out}`,
    // Long enough for the webfont to arrive: the card is mostly type, and
    // rendering it in the fallback face is the one failure nobody notices
    // until it is on a timeline.
    "--virtual-time-budget=6000",
    page,
  ],
  { stdout: "ignore", stderr: "pipe" },
)
const said = await new Response(chrome.stderr).text()
if ((await chrome.exited) !== 0) throw new Error(`chrome failed: ${said}`)
const file = Bun.file(`${import.meta.dir}/${out}`)
if (!(await file.exists())) throw new Error(`chrome wrote no ${out}: ${said}`)
console.log(`wrote ${out} (${await file.size} bytes) at 1200x630`)
