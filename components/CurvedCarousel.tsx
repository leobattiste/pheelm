"use client"

import * as React from "react"

// A photo carousel seen through a curved lens. The cards sit on one WebGL canvas:
// the middle one reads flat, and the further a card travels from the centre, the
// taller and more bent it grows, with a fringe of chromatic split at the rim.
// Drag, flick, arrow keys or the buttons; it settles on a spring and loops.

export type LensSlide = {
  title: string
  /** Small line above the title, e.g. a place or a category. */
  kicker?: string
  /** One short line under the title. */
  caption?: string
  /** Photo URL. Portrait (about 4:5) reads best. Remote URLs need CORS. */
  image: string
  alt?: string
}

export type CurvedLensCarouselProps = {
  slides: LensSlide[]
  /** Small label, top left. */
  label?: React.ReactNode
  /** Accessible name of the carousel. */
  ariaLabel?: string
  /** Only the cards: no title, counter or buttons. */
  bare?: boolean
  /** How hard the lens bends the outer cards. 0 is flat. */
  bend?: number
  /** Drift speed in cards per second. 0 or unset keeps the carousel still until moved. Pauses while hovered or dragged, and with reduced motion. */
  auto?: number
  /** Stage colour behind the cards. */
  background?: string
  /** Text colour on the stage. */
  ink?: string
  /** Stage height. Keep it a definite length; percentages collapse once installed. */
  height?: string
  className?: string
  onChange?: (index: number) => void
}

// #region motion
/** Wraps any index into 0..n-1. */
export function wrap(i: number, n: number): number {
  return n > 0 ? ((i % n) + n) % n : 0
}

/** Signed distance of slide i from the scroll position, taking the short way round a loop of n. */
export function offsetOf(i: number, pos: number, n: number): number {
  if (n <= 0) return 0
  const d = wrap(i - pos + n / 2, n) - n / 2
  return d
}

/** Where a flick comes to rest: the nearest whole slide past the release, at most `max` away. */
export function restFor(pos: number, velocity: number, max = 3): number {
  const throwTo = pos + Math.max(-max, Math.min(max, velocity * 0.18))
  return Math.round(throwTo)
}

/** One step of a critically damped spring (slides, slides/s, seconds). */
export function springStep(pos: number, vel: number, target: number, dt: number, omega = 11): [number, number] {
  const a = (target - pos) * omega * omega - vel * 2 * omega
  const v = vel + a * dt
  return [pos + v * dt, v]
}

/** Card size in px for a stage of w × h: portrait cards, smaller share of a wide stage. */
export function cardSize(w: number, h: number): [number, number] {
  const cw = Math.min(w < 640 ? w * 0.65 : w * 0.26, h * 0.39)
  return [Math.round(cw), Math.round(cw * 1.5)]
}

/** "01" style counter. */
export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}
// #endregion

const VERT =
  "attribute vec2 aPos;" +
  "uniform vec2 uRes;uniform vec2 uSize;uniform float uX;uniform float uBend;uniform float uVel;uniform float uIntro;uniform float uLift;" +
  "varying vec2 vUv;varying float vX;" +
  "void main(){" +
  "vec2 p=vec2(uX+(aPos.x-.5)*uSize.x,(aPos.y-.5)*uSize.y);" +
  "p.y-=(1.-uIntro)*uSize.y*.9;" +
  "vec2 n=p/(uRes*.5);" +
  "float x=clamp(n.x,-1.4,1.4);" +
  "n.y*=1.+uBend*x*x;" +
  "n.y+=uVel*.05*sin(aPos.x*3.14159)*(aPos.y-.5);" +
  "n.x*=1.-.06*uBend*x*x;n.y+=uLift;" +
  "vUv=aPos;vX=x;" +
  "gl_Position=vec4(n,0.,1.);}"

const FRAG =
  "precision highp float;" +
  "uniform sampler2D uTex;uniform vec2 uSize;uniform float uAspect;uniform float uVel;uniform float uIntro;uniform float uShift;uniform float uReady;" +
  "varying vec2 vUv;varying float vX;" +
  "float box(vec2 q,vec2 b,float r){vec2 d=abs(q)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}" +
  "void main(){" +
  "float a=uSize.x/uSize.y;vec2 uv=vUv-.5;" +
  "if(uAspect>a)uv.x*=a/uAspect;else uv.y*=uAspect/a;" +
  "uv+=.5;" +
  "float ca=(.0012+.0045*vX*vX)*(1.+abs(uVel)*1.2);" +
  "vec3 c=vec3(texture2D(uTex,uv+vec2(ca,0.)).r,texture2D(uTex,uv).g,texture2D(uTex,uv-vec2(ca,0.)).b);" +
  "c=mix(vec3(.11,.11,.12),c,uReady);" +
  "c*=1.-.42*min(1.,vX*vX);" +
  "float d=box((vUv-.5)*uSize,uSize*.5,14.);" +
  "float rim=smoothstep(-5.,0.,d);" +
  "c+=rim*.10;" +
  "c+=.07*smoothstep(.55,1.,vUv.y)*(1.-abs(vX));" +
  "float al=smoothstep(.75,-.75,d)*uIntro;" +
  "gl_FragColor=vec4(c*al,al);}"

const CSS =
  ".clc-root{position:relative;width:100%;overflow:hidden;isolation:isolate;outline:none;user-select:none;-webkit-user-select:none;font-family:ui-sans-serif,system-ui,sans-serif}" +
  ".clc-root:focus-visible{box-shadow:inset 0 0 0 2px var(--clc-ink)}" +
  ".clc-glow{position:absolute;inset:-20%;background:radial-gradient(50% 40% at 50% 46%,color-mix(in srgb,var(--clc-ink) 7%,transparent),transparent 70%);pointer-events:none}" +
  ".clc-grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;pointer-events:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")}" +
  ".clc-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y}" +
  ".clc-canvas:active{cursor:grabbing}" +
  ".clc-top{position:absolute;left:clamp(20px,4vw,48px);right:clamp(20px,4vw,48px);top:clamp(18px,3.4vw,36px);display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--clc-ink);opacity:.62;pointer-events:none}" +
  ".clc-top b{font-weight:500;letter-spacing:.14em}" +
  ".clc-copy{position:absolute;left:clamp(20px,4vw,48px);bottom:clamp(22px,4vw,44px);max-width:min(560px,70%);color:var(--clc-ink);pointer-events:none}" +
  ".clc-kicker{display:block;font-size:14px;letter-spacing:0;opacity:.7;margin-bottom:10px}" +
  ".clc-title{font-family:var(--clc-font);font-weight:400;font-size:clamp(44px,7.2vw,104px);line-height:.92;letter-spacing:-.02em;margin:0;display:block}" +
  ".clc-ch{display:inline-block;transform:translateY(105%) rotate(6deg);opacity:0;transition:transform .9s cubic-bezier(.2,.9,.1,1),opacity .6s ease}" +
  ".clc-line{display:block;overflow:hidden;padding-bottom:.06em}" +
  ".clc-in .clc-ch{transform:none;opacity:1}" +
  ".clc-cap{display:block;margin-top:14px;font-size:14px;line-height:1.5;opacity:0;transform:translateY(10px);transition:opacity .7s ease .25s,transform .7s cubic-bezier(.2,.9,.1,1) .25s;max-width:34ch}" +
  ".clc-in .clc-cap{opacity:.66;transform:none}" +
  ".clc-ctl{position:absolute;right:clamp(20px,4vw,48px);bottom:clamp(22px,4vw,44px);display:flex;flex-direction:column;align-items:flex-end;gap:16px;color:var(--clc-ink)}" +
  ".clc-count{font-size:12px;letter-spacing:.18em;font-variant-numeric:tabular-nums;opacity:.8}" +
  ".clc-count i{font-style:normal;opacity:.45}" +
  ".clc-bar{width:132px;height:2px;border-radius:2px;background:color-mix(in srgb,var(--clc-ink) 16%,transparent);overflow:hidden}" +
  ".clc-bar>span{display:block;height:100%;width:100%;background:var(--clc-ink);transform-origin:0 50%;transition:transform .7s cubic-bezier(.2,.9,.1,1)}" +
  ".clc-btns{display:flex;gap:10px}" +
  ".clc-btn{width:46px;height:46px;border-radius:999px;display:grid;place-items:center;color:var(--clc-ink);cursor:pointer;" +
  "background:color-mix(in srgb,var(--clc-ink) 8%,transparent);border:1px solid color-mix(in srgb,var(--clc-ink) 16%,transparent);" +
  "box-shadow:none;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);" +
  "transition:transform .35s cubic-bezier(.3,1.6,.5,1),background .3s ease,border-color .3s ease}" +
  ".clc-btn:hover{transform:translateY(-2px) scale(1.06);background:color-mix(in srgb,var(--clc-ink) 16%,transparent);border-color:color-mix(in srgb,var(--clc-ink) 30%,transparent)}" +
  ".clc-btn:active{transform:scale(.94)}" +
  ".clc-btn:focus-visible{outline:2px solid var(--clc-ink);outline-offset:3px}" +
  ".clc-btn svg{width:18px;height:18px}" +
  ".clc-fallback{position:absolute;left:50%;top:50%;width:min(62vw,360px);aspect-ratio:4/5;transform:translate(-50%,-50%);object-fit:cover;border-radius:14px;max-width:none}" +
  ".clc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
  "@media (max-width:640px){.clc-copy{max-width:calc(100% - 40px);bottom:96px}.clc-ctl{flex-direction:row;align-items:center;left:20px;justify-content:space-between}.clc-bar{width:96px}}" +
  "@media (prefers-reduced-motion:reduce){.clc-ch,.clc-cap,.clc-bar>span,.clc-btn{transition:opacity .2s ease}.clc-ch{transform:none}.clc-cap{transform:none}}"

type GLState = {
  gl: WebGLRenderingContext
  prog: WebGLProgram
  buf: WebGLBuffer
  count: number
  u: Record<string, WebGLUniformLocation | null>
  tex: { t: WebGLTexture; aspect: number; ready: boolean }[]
}

function shader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type) as WebGLShader
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

/** A (segX × segY) grid of quads as triangles, positions 0..1. */
function grid(segX: number, segY: number): Float32Array {
  const out: number[] = []
  for (let y = 0; y < segY; y++)
    for (let x = 0; x < segX; x++) {
      const x0 = x / segX, x1 = (x + 1) / segX, y0 = y / segY, y1 = (y + 1) / segY
      out.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1)
    }
  return new Float32Array(out)
}

function Chars({ text, base }: { text: string; base: number }) {
  return (
    <>
      {text.split(" ").map((word, w, all) => (
        <React.Fragment key={w}>
          <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {word.split("").map((ch, i) => (
              <span key={i} className="clc-ch" style={{ transitionDelay: base + (all.slice(0, w).join(" ").length + i) * 24 + "ms" }}>
                {ch}
              </span>
            ))}
          </span>
          {w < all.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </>
  )
}

/** The caption block. Mounted fresh per slide, then flipped on next frame so the letters rise. */
function Copy({ slide, shown }: { slide: LensSlide; shown: boolean }) {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    if (!shown) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)))
    return () => cancelAnimationFrame(id)
  }, [shown])
  return (
    <div className={"clc-copy" + (on ? " clc-in" : "")} aria-live="polite">
      {slide.kicker ? <span className="clc-kicker">{slide.kicker}</span> : null}
      <h2 className="clc-title">
        <span className="clc-line">
          <Chars text={slide.title} base={60} />
        </span>
      </h2>
      {slide.caption ? <span className="clc-cap">{slide.caption}</span> : null}
    </div>
  )
}

export default function CurvedLensCarousel({
  slides,
  label,
  ariaLabel,
  bare,
  bend = 0.55,
  auto = 0,
  background = "transparent",
  ink = "#f3ede4",
  height = "100svh",
  className,
  onChange,
}: CurvedLensCarouselProps) {
  const n = slides.length
  const rootRef = React.useRef(null as HTMLDivElement | null)
  const canvasRef = React.useRef(null as HTMLCanvasElement | null)
  const [index, setIndex] = React.useState(0)
  const [shown, setShown] = React.useState(false)
  const [noGL, setNoGL] = React.useState(false)
  const api = React.useRef({ go: (_d: number) => {} })
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root || n === 0) return
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true })
    if (!gl) {
      setNoGL(true)
      setShown(true)
      return
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const prog = gl.createProgram() as WebGLProgram
    gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("3d-curved-carousel: " + gl.getProgramInfoLog(prog))
      setNoGL(true)
      setShown(true)
      return
    }
    gl.useProgram(prog)
    const mesh = grid(36, 12)
    const buf = gl.createBuffer() as WebGLBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u: GLState["u"] = {}
    for (const k of ["uRes", "uSize", "uX", "uBend", "uVel", "uIntro", "uTex", "uAspect", "uShift", "uReady", "uLift"]) u[k] = gl.getUniformLocation(prog, k)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    let disposed = false
    const tex = slides.map((s) => {
      const t = gl.createTexture() as WebGLTexture
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([28, 28, 30, 255]))
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
        gl.texParameteri(gl.TEXTURE_2D, p, v)
      const entry = { t, aspect: 0.8, ready: false }
      const img = new Image()
      if (!s.image.startsWith("data:")) img.crossOrigin = "anonymous"
      img.decoding = "async"
      img.onload = () => {
        if (disposed) return
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        entry.aspect = img.naturalWidth / img.naturalHeight
        entry.ready = true
        kick()
      }
      let retried = false
      img.onerror = () => {
        if (disposed || retried) return
        retried = true
        img.src = s.image + (s.image.includes("?") ? "&" : "?") + "cors=1"
      }
      img.src = s.image
      return entry
    })

    // Stage size, measured on resize only; the frame loop reads these numbers.
    let W = 1, H = 1, dpr = 1, cw = 1, ch = 1, gap = 1
    let pos = 0, vel = 0, target = 0
    let intro = reduced.matches ? 1 : 0
    let introStart = -1
    let dragging = false, dragX = 0, dragPos = 0, lastX = 0, lastT = 0, flick = 0
    let raf = 0, last = 0, visible = true, current = 0
    let hovering = false, pausedUntil = 0
    const drifting = () => auto > 0 && !reduced.matches

    const resize = (w: number, h: number) => {
      W = Math.max(1, w)
      H = Math.max(1, h)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ;[cw, ch] = cardSize(W, H)
      gap = cw * 0.14
      gl.viewport(0, 0, canvas.width, canvas.height)
      kick()
    }

    const draw = () => {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(u.uRes, W, H)
      gl.uniform2f(u.uSize, cw, ch)
      gl.uniform1f(u.uBend, bend)
      gl.uniform1f(u.uVel, reduced.matches ? 0 : Math.max(-1, Math.min(1, vel * 0.12)))
      gl.uniform1f(u.uLift, W < 640 ? 0.3 : 0.15)
      const step = cw + gap
      for (let i = 0; i < n; i++) {
        const d = offsetOf(i, pos, n)
        const x = d * step
        if (Math.abs(x) > W * 0.5 + step * 1.5) continue
        const order = Math.abs(d)
        const t = Math.max(0, Math.min(1, (intro - order * 0.12) / 0.6))
        const e = 1 - Math.pow(1 - t, 3)
        gl.bindTexture(gl.TEXTURE_2D, tex[i].t)
        gl.uniform1f(u.uX, x)
        gl.uniform1f(u.uIntro, e)
        gl.uniform1f(u.uAspect, tex[i].aspect)
        gl.uniform1f(u.uReady, tex[i].ready ? 1 : 0)
        gl.uniform1f(u.uShift, 0)
        gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 2)
      }
    }

    const frame = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (intro < 1) {
        if (introStart < 0) introStart = now
        intro = Math.min(1.5, (now - introStart) / 1100)
        if (intro >= 1.5) intro = 1
      }
      if (drifting() && !dragging && !hovering && now > pausedUntil && intro >= 1) target += auto * dt
      if (!dragging) {
        if (reduced.matches) {
          pos = target
          vel = 0
        } else [pos, vel] = springStep(pos, vel, target, dt)
      }
      const idx = wrap(Math.round(pos), n)
      if (idx !== current) {
        current = idx
        setIndex(idx)
        onChangeRef.current?.(idx)
      }
      draw()
      const settled = !drifting() && !dragging && Math.abs(target - pos) < 0.0005 && Math.abs(vel) < 0.001 && (intro >= 1 || reduced.matches)
      if (settled) {
        pos = target
        draw()
        last = 0
      } else if (visible) raf = requestAnimationFrame(frame)
    }

    function kick() {
      if (!raf && visible && !disposed) raf = requestAnimationFrame(frame)
    }

    api.current.go = (dir: number) => {
      pausedUntil = performance.now() + 2500
      target = Math.round(target) + dir
      kick()
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      dragX = lastX = e.clientX
      lastT = e.timeStamp
      dragPos = pos
      flick = 0
      canvas.setPointerCapture(e.pointerId)
      kick()
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const step = cw + gap
      const p = dragPos - (e.clientX - dragX) / step
      const dts = Math.max(1, e.timeStamp - lastT) / 1000
      flick = flick * 0.6 + (-(e.clientX - lastX) / step / dts) * 0.4
      vel = flick
      lastX = e.clientX
      lastT = e.timeStamp
      pos = p
      kick()
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      pausedUntil = performance.now() + 2500
      target = restFor(pos, flick)
      vel = flick
      kick()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") api.current.go(1)
      else if (e.key === "ArrowLeft") api.current.go(-1)
      else return
      e.preventDefault()
    }
    const onMotion = () => kick()
    const onEnter = (e: PointerEvent) => { if (e.pointerType === "mouse") hovering = true }
    const onLeave = () => { hovering = false; pausedUntil = performance.now() + 600; kick() }

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)
    root.addEventListener("pointerenter", onEnter)
    root.addEventListener("pointerleave", onLeave)
    root.addEventListener("keydown", onKey)
    reduced.addEventListener("change", onMotion)

    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      resize(r.width, r.height)
    })
    ro.observe(root)
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting
      if (visible) {
        setShown(true)
        kick()
      }
    })
    io.observe(root)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      root.removeEventListener("pointerenter", onEnter)
      root.removeEventListener("pointerleave", onLeave)
      root.removeEventListener("keydown", onKey)
      reduced.removeEventListener("change", onMotion)
      for (const t of tex) gl.deleteTexture(t.t)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [n, slides, bend, auto])

  const slide = slides[index] ?? slides[0]
  if (!slide) return null
  const vars = { height, background, "--clc-ink": ink, "--clc-font": "inherit" } as React.CSSProperties

  return (
    <div
      ref={rootRef}
      className={"clc-root" + (className ? " " + className : "")}
      style={vars}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel ?? (typeof label === "string" ? label : "Carousel")}
    >
      <style>{CSS}</style>
      {bare ? null : <div className="clc-glow" aria-hidden="true" />}
      <canvas ref={canvasRef} className="clc-canvas" aria-hidden="true" />
      {noGL ? <img className="clc-fallback" src={slide.image} alt={slide.alt ?? slide.title} /> : null}
      {bare ? null : <div className="clc-grain" aria-hidden="true" />}
      {label ? (
        <div className="clc-top">
          <b>{label}</b>
        </div>
      ) : null}
      {bare ? (
        <span className="clc-sr" aria-live="polite">{slide.title}</span>
      ) : (
        <>
      <Copy key={index} slide={slide} shown={shown} />
      <div className="clc-ctl">
        <span className="clc-count">
          {pad2(index + 1)} <i>/ {pad2(n)}</i>
        </span>
        <span className="clc-bar" aria-hidden="true">
          <span style={{ transform: "scaleX(" + (index + 1) / n + ")" }} />
        </span>
        <div className="clc-btns">
          <button type="button" className="clc-btn" aria-label="Previous slide" onClick={() => api.current.go(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="clc-btn" aria-label="Next slide" onClick={() => api.current.go(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
