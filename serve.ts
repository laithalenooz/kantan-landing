/**
 * Serves the landing page for a look, on `127.0.0.1:4173`.
 *
 *   bun run build              # regenerate index.html from the artboard
 *   bun run serve              # look at it on 127.0.0.1:4173
 *
 * Nothing to do with kantan's own server: no guards, no token, no state. It
 * exists because a landing page is the one artefact you cannot judge from its
 * source, and `file://` will not do - the page loads `dc.js` beside it, and a
 * file-origin page cannot always fetch its own siblings.
 *
 * `no-store` on everything, because the whole point is editing the artboard,
 * re-running the build and reloading.
 */

import { join, normalize } from "node:path"

const ROOT = join(import.meta.dir, "public")
const PORT = Number(process.env["KANTAN_LANDING_PORT"] ?? 4173)

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  /* `text/plain`, not a download. The install script's whole defence is that
     you can read it before you pipe it into a shell, and a browser offered
     `application/octet-stream` saves the file instead of showing it. curl
     never looks at this header either way. */
  ".sh": "text/plain; charset=utf-8",
  "": "text/plain; charset=utf-8",
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    /* `/index.html`, not the page served *at* `/`. Serving it at the root
       made its own relative urls resolve against `/`, so `dc.js` became
       `/dc.js` and the runtime silently 404'd - the page then rendered its raw
       template with every hole still in it. Here the two happen to agree, and
       the redirect keeps them agreeing if the page ever moves into a folder. */
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(null, { status: 302, headers: { Location: "/index.html" } })
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "")
    /* A directory is not a file, and `Bun.file` on one does not exist - so a
       bare `/` or `/assets/` 404'd here while Vercel, which resolves an index
       itself, served it. A preview that disagrees with the deploy is worse
       than no preview.

       The content type then comes from the **resolved** path and not from the
       request: `/` has no extension, so deriving it from the url served the
       page as `application/octet-stream` and the browser offered to download
       the site. */
    const served = rel.endsWith("/") ? join(rel, "index.html") : rel
    const file = Bun.file(join(ROOT, served))
    if (!(await file.exists())) return new Response("not found", { status: 404 })
    const dot = served.lastIndexOf(".")
    return new Response(file, {
      headers: {
        "Content-Type": TYPES[served.slice(dot)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    })
  },
})

console.log(`the landing page on http://127.0.0.1:${server.port}  (reload to see a rebuild)`)
