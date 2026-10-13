# kantan-landing

The landing page for [kantan](https://github.com/laithalenooz/kantan).

**The page is generated, not hand-written.** Its design lives as the `Landing`
artboard in kantan's design canvas, alongside the artboards the app itself was
built from. `build.ts` reads that artboard and emits `index.html`, so the
canvas stays the single source: a revision there is one command here, and there
is no second copy to drift.

```bash
bun run build     # Landing.dc.html -> index.html
bun run serve     # look at it on 127.0.0.1:4173
bun run dev       # both
```

No dependencies, no bundler, no framework. `index.html` is committed, so
publishing it is a static upload of this directory.

## How the generation works

An artboard is a *Design Component* page: fixed markup plus four constructs,
fed by a `renderVals()` on a `DCLogic` subclass.

| In the artboard | `dc.js` does |
|---|---|
| `{{dotted.path}}` | looks it up, in the loop scope first |
| `<sc-for list="{{xs}}" as="x">` | unrolls it |
| `<sc-if value="{{flag}}">` | keeps or drops the subtree |
| `onClick="{{fn}}"` | binds a real listener |

`build.ts` implements nothing else, and **refuses** an artboard that uses
anything else rather than rendering it as nothing — a construct that silently
disappears leaves a hole nobody notices until a reader does.

### `dc.js` morphs the tree, and that is the whole of it

The first version rebuilt the subtree on every `setState`. Twenty lines,
correct output, visibly broken: recreating an element **restarts every CSS
animation on it**, and this page is built out of them — entrance fades, a
tilt-in, a conic beam, a marquee, counters that count up, a scribble that draws
itself. The gate re-enactment calls `setState` on a timer four times in a row,
so the whole page re-animated every 1.1 seconds. It read as flicker and missing
animation, which is exactly what that is.

So element identity survives a render. Children are reconciled by position
*after* the loops and conditionals are expanded, a matching tag is reused, only
attributes that actually differ are written — writing `class` back onto an
element re-triggers an animation whose name is still listed — and handlers live
in a slot behind one dispatcher per event rather than being rebound.

Verified rather than assumed: across a state change every animated node is the
same element, and the beam and marquee clocks keep running instead of resetting
to zero.

## `assets/`

The four screenshots the page uses. Inside the design canvas an upload is
served at `/_blob/<id>`, which resolves nowhere else, so the build rewrites
those urls to these files. A referenced file that is missing fails the build:
a broken `<img>` inside a dark mock frame is close to invisible.

They are real screenshots of kantan, taken by `docs/probes/states.ts` in the
main repo — an ordinary kantan booted against a scratch home, so they are the
product and not a mockup.

## What the page claims

Every figure in it is measured, and four of them move whenever kantan does:
module count, test count, `src/run.ts`'s length and the bundle size. Re-measure
before publishing. `docs/marketing/SYSTEM.md` in the main repo is the brief
behind the copy and names the commands.

One line the page must never cross, because it is kantan's own rule: nothing
may claim a verification it did not observe. "Your tests decide, and when there
are none it says so" is true; "always verified by your tests" is not.

## Licence

MIT, as kantan is.
