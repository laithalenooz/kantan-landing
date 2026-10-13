/**
 * What makes `curl kantan.sh | sh` work.
 *
 * The bare root has to answer two different things: a shell script to curl,
 * and the page to a browser. No static host can do that - GitHub Pages serves
 * one file per path and has no way to look at a request - so this is a
 * Cloudflare Worker on the route `kantan.sh/*`, in front of wherever the page
 * is hosted.
 *
 * Deploy:
 *   npx wrangler deploy worker.js --name kantan-sh --compatibility-date 2026-01-01
 * then add the route `kantan.sh/*` to it in the dashboard.
 *
 * **The sniff is on the User-Agent, which is a guess, so it fails toward the
 * page.** The dimension is one request header; its values are curl, wget,
 * httpie, fetch and every browser, plus requests that send none at all. The
 * two directions cost differently and not symmetrically:
 *
 * - Serving the **script to a browser** shows a wall of shell to a person who
 *   wanted to read about the tool. Bad, and silent.
 * - Serving the **page to curl** pipes HTML into sh, which prints a parse
 *   error and does nothing. Confusing for a second, harmless, and the honest
 *   path `kantan.sh/install.sh` is one line away in the README.
 *
 * So only an explicit, known command-line agent gets the script. Anything
 * unrecognised, and anything with no User-Agent at all, gets the page.
 */

const SCRIPT = "/install.sh"

/** Agents that are unambiguously a terminal, matched at the start of the UA. */
const SHELLS = [/^curl\//i, /^Wget/i, /^HTTPie\//i, /^fetch\//i, /^libcurl\//i]

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url)
    const agent = request.headers.get("user-agent") ?? ""

    // Only the bare root is ambiguous. Every other path means what it says,
    // including `/install.sh` itself, so a reader can always be explicit.
    if (url.pathname === "/" && SHELLS.some((re) => re.test(agent))) {
      const script = new URL(SCRIPT, url.origin)
      const answer = await fetch(script, { headers: { "user-agent": agent } })
      if (!answer.ok) return answer
      return new Response(answer.body, {
        status: 200,
        headers: {
          "Content-Type": "text/x-shellscript; charset=utf-8",
          /* Short, not immutable: this is the one url whose contents people
             pipe into a shell without reading, so a stale cached copy is the
             worst thing to serve from it. */
          "Cache-Control": "public, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    return fetch(request)
  },
}
