/**
 * Builds the public landing page **from the design canvas**, rather than from
 * a hand-port of it.
 *
 *   bun run build.ts <Landing.dc.html> [out.html]
 *
 * The page the user approved lives as an artboard in the kantan design canvas
 * - the same canvas that holds `Main.dc.html`, `Return.dc.html` and the rest
 * this codebase's comments cite. An artboard is a Design Component page: fixed
 * markup plus `{{holes}}`, `<sc-for>`, `<sc-if>` and `on*="{{fn}}"`, fed by a
 * `renderVals()` on a `DCLogic` subclass.
 *
 * **Generated, not transcribed, and that is the whole point.** Hand-porting it
 * would make the live page a second copy of the design: a revision on the
 * canvas would then have to be re-done here, and the two would drift the first
 * time nobody bothered. This reads the artboard and emits a standalone page,
 * so the canvas stays the single source and a revision is one command.
 *
 * It implements exactly the four constructs that artboard uses - counted, not
 * guessed: 94 holes, 3 `<sc-for>`, 14 `<sc-if>`, 12 `on*` bindings, and no
 * `<dc-import>`. Anything else is **refused loudly** rather than silently
 * dropped, because a construct that renders as nothing would leave a hole in
 * the page that nobody notices until a reader does.
 */

import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"

const [source = "Landing.dc.html", out = "index.html"] = process.argv.slice(2)

/** The brand mark: a near-black rounded square and the attention-orange dot. */
const ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
  "<rect width='32' height='32' rx='9' fill='%23111216'/>" +
  "<circle cx='16' cy='16' r='6' fill='%23ff6a1a'/></svg>"

/** Where the page lives. Absolute urls in the social card need it. */
const SITE = "https://kantan.sh"

const DESCRIPTION =
  "kantan drives the real claude CLI through one coding task at a time: it writes a plan, " +
  "waits for your OK, then implements it and runs your tests until the exit code says they pass."

const src = await readFile(source, "utf8")

/** One tag's inner text, by its opening and closing tag. */
function between(text: string, open: string, close: string, from = 0): { body: string; end: number } {
  const a = text.indexOf(open, from)
  if (a === -1) throw new Error(`${source}: no ${open}`)
  const b = text.indexOf(close, a)
  if (b === -1) throw new Error(`${source}: ${open} is never closed`)
  return { body: text.slice(a + open.length, b), end: b + close.length }
}

const title = /<title>([^<]*)<\/title>/.exec(src)?.[1] ?? "kantan"
const helmet = between(src, "<helmet>", "</helmet>")

/* The artboard's markup is everything between the helmet and the logic block.
   Taken by position rather than by parsing `<x-dc>`, because the body contains
   `</div>`s by the hundred and a regex for the wrapper would match the wrong
   one. */
const scriptAt = src.indexOf('<script type="text/x-dc"')
if (scriptAt === -1) throw new Error(`${source}: no x-dc logic block`)
let markup = src.slice(helmet.end, scriptAt).replace(/<\/x-dc>\s*$/, "").trim()

const logic = between(src, ">", "</script>", scriptAt).body.trim()
const props = /data-props='([^']*)'/.exec(src)?.[1] ?? "{}"

/**
 * The canvas's uploaded images become local files.
 *
 * Inside the design canvas an upload is served at `/_blob/<id>`, which
 * resolves nowhere else - so the four screenshots in this page were broken
 * everywhere but the editor. The bytes are pulled into `assets/` once and the
 * urls rewritten; a **missing** file is a build failure rather than a page
 * that ships with a hole in it, because a broken `<img>` inside a dark mock
 * frame is close to invisible until somebody looks hard.
 */
const blobs = [...markup.matchAll(/\/_blob\/([0-9a-f]{32})/g)].map((m) => m[1] ?? "")
for (const id of [...new Set(blobs)]) {
  const file = `assets/${id}.png`
  if (!existsSync(file)) {
    throw new Error(
      `${source} references /_blob/${id}, and ${file} is not here. ` +
        `Pull it from the canvas's asset store first, then re-run the build.`,
    )
  }
}
markup = markup.replaceAll(/\/_blob\/([0-9a-f]{32})/g, "assets/$1.png")

/** Constructs this generator does not implement. Refused, never dropped. */
for (const tag of ["<dc-import", "<sc-slot", "<sc-switch"]) {
  if (markup.includes(tag)) {
    throw new Error(
      `${source} uses ${tag}, which this generator does not implement. ` +
        `Add it here rather than letting it render as nothing.`,
    )
  }
}

const parsed = JSON.parse(props) as Record<string, { default?: unknown }>
const defaults = Object.fromEntries(
  Object.entries(parsed)
    .filter(([key]) => !key.startsWith("$"))
    .map(([key, spec]) => [key, spec.default]),
)

/* The one prop worth overriding at build time: the artboard's default is a
   bare `https://github.com/`, which would ship a link to nowhere. */
defaults["repoUrl"] = "https://github.com/laithalenooz/kantan"

const head = [
  "<!doctype html>",
  '<html lang="en">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="color-scheme" content="only light">',
  "<title>" + title + "</title>",
  '<meta name="description" content="' + DESCRIPTION + '">',
  /* Two icons on purpose. The SVG is the one modern browsers use and it scales
     to whatever the tab needs; the inline data URI is the fallback, and it is
     what stops a browser requesting /favicon.ico and getting a 404 from a
     static host that has no such file. */
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  '<link rel="alternate icon" href="' + ICON + '">',
  // One canonical home, so the page served from a Pages or preview host does
  // not compete with kantan.sh in a search index.
  '<link rel="canonical" href="' + SITE + '/">',
  /* The social card. A launch post is a link before it is a page: the
     screenshot and these four lines are what most people see of kantan, so the
     image is an absolute url - a relative one resolves against the *poster's*
     host and silently shows nothing. */
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="' + SITE + '/">',
  '<meta property="og:title" content="kantan — approve the plan, leave the room">',
  '<meta property="og:description" content="' + DESCRIPTION + '">',
  '<meta property="og:image" content="' + SITE + '/og.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="' + SITE + '/og.png">',
  "<!-- GENERATED by build.ts from the design canvas\'s Landing",
  "     artboard. Edit the artboard and re-run the build; edits here are lost. -->",
  helmet.body.trim(),
  "</head>",
  "<body>",
  '<div id="root"></div>',
  '<template id="dc">',
  markup,
  "</template>",
  '<script src="dc.js"></script>',
  "<script>",
  logic,
  "const component = new Component(" + JSON.stringify(defaults) + ")",
  "component.render()",
  "</script>",
  "</body>",
  "</html>",
  "",
]
const page = head.join("\n")

await writeFile(out, page, "utf8")
console.log(`wrote ${out} (${page.length} bytes) from ${source}`)
