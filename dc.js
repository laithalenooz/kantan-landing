/**
 * The four Design Component constructs the Landing artboard uses, rendered by
 * **morphing** the live tree rather than replacing it.
 *
 * The landing page is generated from an artboard in the kantan design canvas
 * (`docs/landing/build.ts`): fixed markup plus holes, loops, conditionals and
 * event bindings, fed by a `renderVals()` on a `DCLogic` subclass.
 *
 * **Why morphing, and not the obvious thing.** The first version rebuilt the
 * subtree on every `setState` - twenty lines, correct output, and visibly
 * broken. Recreating an element restarts every CSS animation on it, and this
 * page is built out of them: entrance fades, a tilt-in, a conic beam, a
 * marquee, counters that count up, a scribble that draws itself, floats and
 * spinners. The gate re-enactment calls `setState` on a timer four times in a
 * row, so the whole page re-animated every 1.1 seconds. Reported from use as
 * "animations missing, glitches happening", which is exactly what that looks
 * like: an animation that restarts mid-flight reads as a flicker, and one with
 * `animation-fill-mode: both` and a delay snaps back to its start frame.
 *
 * So element identity has to survive a render. Three rules carry that:
 *
 * 1. **Children are reconciled by position**, after `sc-for` and `sc-if` are
 *    expanded into a flat list - they produce a varying number of siblings, so
 *    aligning the template against the live tree before expanding them would
 *    compare the wrong pairs.
 * 2. **A matching tag at the same position is reused**, and only the
 *    attributes that actually differ are written. Setting an identical
 *    `style` string back onto an element is enough to restart nothing, but
 *    writing `class` is: changing `class` re-triggers an animation whose name
 *    is still listed, so an unchanged value is never written.
 * 3. **Handlers are stored, not rebound.** Each element gets one dispatcher
 *    per event type and a slot holding the current function. Re-binding on
 *    every render would be correct too, but this keeps the element untouched.
 *
 * It is still not a framework: no keys, no fragments, no lifecycle. One page.
 */

const HOLE = /\{\{\s*([A-Za-z0-9_.$]+)\s*\}\}/g

/** A dotted lookup, in the loop scope first and then the render values. */
function look(path, vals, scope) {
  const parts = path.split(".")
  let at = parts[0] in scope ? scope : vals
  for (const part of parts) {
    if (at === null || at === undefined) return undefined
    at = at[part]
  }
  return at
}

/**
 * A value for one attribute or text node.
 *
 * A hole that is the **whole** string resolves to the value itself, so a
 * function, an array or a boolean survives. Anything else is interpolated into
 * the surrounding text. Without that split, `onClick="{{approve}}"` would bind
 * the string "() => {…}" and every button on the page would be inert.
 */
function resolve(text, vals, scope) {
  const found = text.match(HOLE)
  if (found !== null && found.length === 1 && found[0] === text.trim()) {
    return look(found[0].replace(HOLE, "$1"), vals, scope)
  }
  return text.replace(HOLE, (_, path) => {
    const value = look(path, vals, scope)
    return value === undefined || value === null ? "" : String(value)
  })
}

/**
 * The template's children for this scope, flattened: every `sc-for` unrolled
 * and every `sc-if` resolved, so what comes back is the exact sequence of
 * nodes the live tree should hold.
 */
function plan(node, vals, scope, out) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push({ text: resolve(child.nodeValue ?? "", vals, scope) })
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const tag = child.tagName.toLowerCase()

    if (tag === "sc-for") {
      const list = resolve(child.getAttribute("list") ?? "", vals, scope)
      const as = child.getAttribute("as") ?? "item"
      for (const item of Array.isArray(list) ? list : []) {
        plan(child, vals, { ...scope, [as]: item }, out)
      }
      continue
    }
    if (tag === "sc-if") {
      if (resolve(child.getAttribute("value") ?? "", vals, scope)) plan(child, vals, scope, out)
      continue
    }
    out.push({ tag, node: child, vals, scope })
  }
  return out
}

/** One dispatcher per element per event, reading a slot that render updates. */
function bind(el, type, fn) {
  if (el._dc === undefined) el._dc = {}
  const first = !(type in el._dc)
  el._dc[type] = fn
  if (first) {
    el.addEventListener(type, (event) => {
      const handler = el._dc[type]
      if (typeof handler === "function") handler(event)
    })
  }
}

/** Writes only what differs, because writing `class` restarts an animation. */
function attributes(el, template, vals, scope) {
  const wanted = new Set()
  for (const attr of template.attributes) {
    const raw = attr.value
    if (!raw.includes("{{")) {
      wanted.add(attr.name)
      if (el.getAttribute(attr.name) !== raw) el.setAttribute(attr.name, raw)
      continue
    }
    const got = resolve(raw, vals, scope)
    if (attr.name.startsWith("on")) {
      /* Bound, never left on the element: an inline handler would need the
         function to survive being turned into a string. The event name is the
         rest of the attribute lowercased, because the markup writes it
         React-style - onClick, onChange. */
      if (typeof got === "function") bind(el, attr.name.slice(2).toLowerCase(), got)
      continue
    }
    wanted.add(attr.name)
    const next = got === undefined || got === null ? "" : String(got)
    if (el.getAttribute(attr.name) !== next) el.setAttribute(attr.name, next)
  }
  // An attribute the template no longer sets - `hidden` going away, say.
  for (const attr of [...el.attributes]) {
    if (!wanted.has(attr.name) && !attr.name.startsWith("data-dc")) el.removeAttribute(attr.name)
  }
}

function patch(parent, wanted) {
  const live = parent.childNodes
  for (const [i, want] of wanted.entries()) {
    const at = live[i]

    if ("text" in want) {
      if (at !== undefined && at.nodeType === Node.TEXT_NODE) {
        if (at.nodeValue !== want.text) at.nodeValue = want.text
      } else {
        const made = document.createTextNode(want.text)
        if (at === undefined) parent.append(made)
        else parent.replaceChild(made, at)
      }
      continue
    }

    let el = at
    if (el === undefined || el.nodeType !== Node.ELEMENT_NODE || el.tagName.toLowerCase() !== want.tag) {
      const made = document.createElement(want.tag)
      if (el === undefined) parent.append(made)
      else parent.replaceChild(made, el)
      el = made
    }
    attributes(el, want.node, want.vals, want.scope)
    patch(el, plan(want.node, want.vals, want.scope, []))
  }
  // Anything the template no longer asks for.
  while (live.length > wanted.length) parent.removeChild(live[live.length - 1])
}

window.DCLogic = class DCLogic {
  constructor(props) {
    this.props = props ?? {}
    this.state = {}
  }
  setState(patchState) {
    this.state = { ...this.state, ...patchState }
    this.render()
  }
  render() {
    const root = document.getElementById("root")
    const template = document.getElementById("dc")
    const vals = this.renderVals()
    /* No focus bookkeeping: morphing keeps the field, so the caret stays
       where it was. That was twenty lines in the version that replaced the
       tree, and it only ever papered over the same cause as the flicker. */
    patch(root, plan(template.content, vals, {}, []))
  }
}
