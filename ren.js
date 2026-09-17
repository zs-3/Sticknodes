/* ═══════════════════════════════════════════════════════════════════════
   renderer_canvas_json.js
   StickNodes Canvas 2D renderer + JSON document layer

   Design:
     .nodes <-> sticknodes-rs WASM <-> JSON document <-> Canvas renderer

   The WASM/StickNodes engine remains the source of truth for node
   transforms, locks, smart-stretch, serialization and polyfill geometry.
   This file does NOT use XML.

   Coordinates: StickNodes world coordinates, Y-down.
   Rendering: Canvas 2D.
   Node handles: only actual limb nodes (RoundedSegment / Segment).
═══════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────
   Constants / safe helpers
────────────────────────────────────────────────────────────────────── */

export const NODE_TYPE = Object.freeze({
  ROUNDED_SEGMENT: 0,
  SEGMENT: 1,
  CIRCLE: 2,
  TRIANGLE: 3,
  FILLED_CIRCLE: 4,
  ELLIPSE: 5,
  TRAPEZOID: 6,
  POLYGON: 7
});

const LIMB_TYPES = new Set([
  NODE_TYPE.ROUNDED_SEGMENT,
  NODE_TYPE.SEGMENT
]);

const EPS = 1e-7;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function finitePoint(p) {
  return Array.isArray(p) && p.length >= 2 &&
    Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

function cloneJSON(v) {
  return JSON.parse(JSON.stringify(v));
}

/* ──────────────────────────────────────────────────────────────────────
   Color helpers
────────────────────────────────────────────────────────────────────── */

export function hexToRgba(hex) {
  let h = String(hex ?? "#000000").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split("").map(c => c + c).join("") + "FF";
  } else if (/^[0-9a-fA-F]{4}$/.test(h)) {
    h = h.split("").map(c => c + c).join("");
  } else if (/^[0-9a-fA-F]{6}$/.test(h)) {
    h += "FF";
  } else if (!/^[0-9a-fA-F]{8}$/.test(h)) {
    h = "000000FF";
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16)
  };
}

export function rgbaToHex(c, includeAlpha = false) {
  const h = n => Math.max(0, Math.min(255, Math.round(num(n))) )
    .toString(16).padStart(2, "0").toUpperCase();
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  return includeAlpha ? `${base}${h(c.a)}` : base;
}

function mulColor(c, m) {
  return {
    r: c.r * m,
    g: c.g * m,
    b: c.b * m,
    a: c.a * m
  };
}

function css(c) {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${clamp(c.a / 255, 0, 1)})`;
}

function lerpColor(a, b, t) {
  t = clamp(t);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t
  };
}

/* ──────────────────────────────────────────────────────────────────────
   StickNodes-style interpolation helpers
────────────────────────────────────────────────────────────────────── */

function sineIn(t) {
  return 1 - Math.cos((clamp(t) * Math.PI) / 2);
}

function sineOut(t) {
  return Math.sin((clamp(t) * Math.PI) / 2);
}

function gradientT(t, reverse = false, mode = 0) {
  let x = clamp(t);
  /* StickNodes has multiple gradient modes.  Modes that cannot be
     identified without the enum implementation fall back to the normal
     axis interpolation rather than inventing geometry. */
  if (mode === 1) x = sineIn(x);
  else if (mode === 2) x = sineOut(x);
  return reverse ? 1 - x : x;
}

function aaParams(maxDim) {
  return Math.max(2, Math.floor((maxDim < 80 ? maxDim / 80 : 1) * 6));
}

/* ──────────────────────────────────────────────────────────────────────
   Canvas primitives
────────────────────────────────────────────────────────────────────── */

function pSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function pRSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function pCircle(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(Math.abs(r), 0.01), 0, Math.PI * 2);
  ctx.fill();
}

function pRing(ctx, cx, cy, ro, ri, col) {
  const outer = Math.max(Math.abs(ro), 0.01);
  const inner = Math.max(0, Math.min(outer - EPS, Math.abs(ri)));
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2, false);
  if (inner > EPS) ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
}

function pEllipse(ctx, cx, cy, rx, ry, ang, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") {
    ctx.ellipse(cx, cy, Math.max(Math.abs(rx), 0.01),
      Math.max(Math.abs(ry), 0.01), ang, 0, Math.PI * 2);
  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.scale(Math.max(Math.abs(rx), 0.01), Math.max(Math.abs(ry), 0.01));
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  }
  ctx.fill();
}

function pTri(ctx, x1, y1, x2, y2, x3, y3, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function pPoly(ctx, cx, cy, r, n, ang, col) {
  n = Math.max(3, Math.floor(num(n, 5)));
  r = Math.max(Math.abs(r), 0.01);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + i * Math.PI * 2 / n;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function trapezoidPath(ctx, x1, y1, x2, y2, w1, w2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.lineTo(x2 - nx * w2 / 2, y2 - ny * w2 / 2);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.closePath();
}

function pTrap(ctx, x1, y1, x2, y2, w1, w2, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  trapezoidPath(ctx, x1, y1, x2, y2, Math.abs(w1), Math.abs(w2));
  ctx.fill();
}

/* ──────────────────────────────────────────────────────────────────────
   Better curved-limb geometry

   The old renderer approximated a curved segment by many straight
   capsules. That produces visible seams and incorrect joins.

   Here Canvas draws one continuous thick arc.  The centerline is the
   circular arc through the two node endpoints using StickNodes'
   signed curve radius convention.  For small/invalid radii we fall back
   to the normal segment.

   This is an intentional Canvas implementation of the geometry described
   by SNShapeRenderer.mySegmentCurved/myRoundedSegment rather than a
   simple "many little lines" approximation.
────────────────────────────────────────────────────────────────────── */

function curveInfo(x1, y1, x2, y2, radius) {
  const dx = x2 - x1, dy = y2 - y1;
  const chord = Math.hypot(dx, dy);
  const R = Math.abs(num(radius));
  if (chord < EPS || R < chord / 2 + EPS) return null;

  const half = chord / 2;
  const sagittaToCenter = Math.sqrt(Math.max(0, R * R - half * half));
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const nx = -dy / chord, ny = dx / chord;
  const sign = num(radius) >= 0 ? 1 : -1;

  const cx = mx + nx * sagittaToCenter * sign;
  const cy = my + ny * sagittaToCenter * sign;

  let a1 = Math.atan2(y1 - cy, x1 - cx);
  let a2 = Math.atan2(y2 - cy, x2 - cx);
  let da = a2 - a1;

  if (sign > 0) {
    while (da < 0) da += Math.PI * 2;
    if (da > Math.PI) da -= Math.PI * 2;
  } else {
    while (da > 0) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
  }

  return { cx, cy, R, a1, a2: a1 + da, da, chord };
}

function strokeArc(ctx, info, thickness, color, rounded) {
  if (!info) return false;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(Math.abs(thickness), 0.01);
  ctx.lineCap = rounded ? "round" : "butt";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
  ctx.stroke();
  return true;
}

function aCurvedSegment(ctx, x1, y1, x2, y2, th, radius, color, rounded) {
  const info = curveInfo(x1, y1, x2, y2, radius);
  if (!info) {
    if (rounded) aRSeg(ctx, x1, y1, x2, y2, th, color);
    else aSeg(ctx, x1, y1, x2, y2, th, color);
    return;
  }

  const c = css(color);
  const dim = css(mulColor(color, rounded ? 0.20 : 0.20));
  const N = aaParams(Math.max(Math.abs(th), info.R * Math.abs(info.da)));

  /* Keep the original StickNodes-style soft outer passes, but apply
     them to the whole continuous curve so there are no segment seams. */
  const grow = rounded ? 0.14 : 0.18666667;
  for (let i = 1; i <= N; i++) {
    const g = grow * i;
    strokeArc(ctx, info, th + g, dim, rounded);
  }
  strokeArc(ctx, info, th, c, rounded);
}

/* ──────────────────────────────────────────────────────────────────────
   AA primitives
────────────────────────────────────────────────────────────────────── */

function aRSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.20));
  const len = Math.hypot(x2 - x1, y2 - y1);
  const N = aaParams(Math.max(Math.abs(th), len));
  let grow = 0;
  for (let i = 0; i < N; i++) {
    grow += 0.14;
    pRSeg(ctx, x1, y1, x2, y2, th + grow, dim);
  }
  pRSeg(ctx, x1, y1, x2, y2, th, col);
}

function aSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.20));
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ca = len > EPS ? (x2 - x1) / len : 1;
  const sa = len > EPS ? (y2 - y1) / len : 0;
  const N = aaParams(Math.max(Math.abs(th), len));
  let grow = 0;
  for (let i = 0; i < N; i++) {
    grow += 0.18666667;
    const h = grow * 0.5;
    pSeg(ctx, x1 - ca * h, y1 - sa * h,
      x2 + ca * h, y2 + sa * h, th + grow, dim);
  }
  pSeg(ctx, x1, y1, x2, y2, th, col);
}

function aCircle(ctx, cx, cy, r, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.20));
  const N = aaParams(Math.abs(r));
  let grow = 0;
  for (let i = 0; i < N; i++) {
    grow += 0.093333334;
    pCircle(ctx, cx, cy, r + grow, dim);
  }
  pCircle(ctx, cx, cy, r, col);
}

function aRing(ctx, cx, cy, ro, ri, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.20));
  const N = aaParams(Math.abs(ro));
  let grow = 0;
  for (let i = 0; i < N; i++) {
    grow += 0.093333334;
    pRing(ctx, cx, cy, ro + grow, ri + grow, dim);
  }
  pRing(ctx, cx, cy, ro, ri, col);
}

function aEllipse(ctx, cx, cy, rx, ry, ang, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.10));
  const jb = 0.42 * Math.min(Math.max(Math.abs(rx), Math.abs(ry)) / 128, 1);
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        pEllipse(ctx, cx + jx * 0.5 * jb * lv,
          cy + jy * 0.5 * jb * lv, rx, ry, ang, dim);
      }
    }
  }
  pEllipse(ctx, cx, cy, rx, ry, ang, col);
}

function aTri(ctx, x1, y1, x2, y2, x3, y3, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.10));
  const jb = 0.28;
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        const ox = jx * 0.5 * jb * lv;
        const oy = jy * 0.5 * jb * lv;
        pTri(ctx, x1 + ox, y1 + oy, x2 + ox, y2 + oy,
          x3 + ox, y3 + oy, dim);
      }
    }
  }
  pTri(ctx, x1, y1, x2, y2, x3, y3, col);
}

function aTrap(ctx, x1, y1, x2, y2, w1, w2, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.10));
  const jb = 0.42 * Math.min(Math.max(Math.abs(w1), Math.abs(w2)) / 80, 1);
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        ctx.save();
        ctx.translate(jx * 0.5 * jb * lv, jy * 0.5 * jb * lv);
        pTrap(ctx, x1, y1, x2, y2, w1, w2, dim);
        ctx.restore();
      }
    }
  }
  pTrap(ctx, x1, y1, x2, y2, w1, w2, col);
}

function aPoly(ctx, cx, cy, r, n, ang, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.20));
  const N = aaParams(Math.abs(r));
  let grow = 0;
  for (let i = 0; i < N; i++) {
    grow += 0.23333333;
    pPoly(ctx, cx, cy, r + grow, n, ang, dim);
  }
  pPoly(ctx, cx, cy, r, n, ang, col);
}

/* ──────────────────────────────────────────────────────────────────────
   Gradient-aware limb drawing

   SNShapeRenderer supplies two colors to segment/trapezoid primitives.
   Canvas 2D can reproduce this more naturally with a gradient.  The
   gradient is deliberately applied only when the node says to use it.
────────────────────────────────────────────────────────────────────── */

function segmentGradient(ctx, x1, y1, x2, y2, c1, c2, axis, reverse, mode) {
  let g;
  if (axis === "x") {
    const min = Math.min(x1, x2), max = Math.max(x1, x2);
    g = ctx.createLinearGradient(min, 0, max, 0);
  } else if (axis === "y") {
    const min = Math.min(y1, y2), max = Math.max(y1, y2);
    g = ctx.createLinearGradient(0, min, 0, max);
  } else {
    g = ctx.createLinearGradient(x1, y1, x2, y2);
  }

  /* Canvas supports color stops; use a few stops so sine interpolation
     is represented instead of pretending it is always linear. */
  const stops = 8;
  for (let i = 0; i <= stops; i++) {
    const raw = i / stops;
    const t = gradientT(raw, reverse, mode);
    g.addColorStop(raw, css(lerpColor(c1, c2, t)));
  }
  return g;
}

function drawGradientSegment(ctx, s) {
  const c1 = s.color;
  const c2 = s.gradientColor || s.color;
  const info = s.curveRadius ? curveInfo(s.sx, s.sy, s.ex, s.ey, s.curveRadius) : null;

  ctx.save();
  ctx.strokeStyle = segmentGradient(ctx, s.sx, s.sy, s.ex, s.ey,
    c1, c2, s.gradientAxis, s.reverseGradient, s.gradientMode);

  ctx.lineWidth = Math.max(Math.abs(s.thickness), 0.01);
  ctx.lineCap = s.type === NODE_TYPE.ROUNDED_SEGMENT ? "round" : "butt";
  ctx.lineJoin = "round";

  if (info) {
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(s.sx, s.sy);
    ctx.lineTo(s.ex, s.ey);
    ctx.stroke();
  }
  ctx.restore();
}

/* ──────────────────────────────────────────────────────────────────────
   Node geometry
────────────────────────────────────────────────────────────────────── */

function drawNode(ctx, s) {
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  if (s.useGradient && (s.type === 0 || s.type === 1)) {
    drawGradientSegment(ctx, s);
    return;
  }

  switch (s.type) {
    case NODE_TYPE.ROUNDED_SEGMENT:
      aCurvedSegment(ctx, s.sx, s.sy, s.ex, s.ey,
        s.thickness, s.curveRadius, s.color, true);
      break;

    case NODE_TYPE.SEGMENT:
      aCurvedSegment(ctx, s.sx, s.sy, s.ex, s.ey,
        s.thickness, s.curveRadius, s.color, false);
      break;

    case NODE_TYPE.CIRCLE: {
      /* StickNodes' circle branch uses (length + thickness)/2 for the
         outside and thickness/2 for the inside. */
      const innerR = Math.max(0, s.thickness / 2);
      const outerR = Math.max(innerR, (Math.abs(len) + Math.abs(s.thickness)) / 2);
      if (s.hollow) aRing(ctx, s.ex, s.ey, outerR, innerR, s.color);
      else aCircle(ctx, s.ex, s.ey, outerR, s.color);
      break;
    }

    case NODE_TYPE.TRIANGLE: {
      const halfBase = Math.max(Math.abs(s.thickness), 0.01) / 2;
      const ux = len > EPS ? dx / len : 1;
      const uy = len > EPS ? dy / len : 0;
      const px = -uy, py = ux;
      let ax = s.sx + px * halfBase, ay = s.sy + py * halfBase;
      let bx = s.sx - px * halfBase, by = s.sy - py * halfBase;
      if (s.triangleFlipped) [ax, bx] = [bx, ax], [ay, by] = [by, ay];
      if (s.triangleUpsideDown) {
        /* Preserve the node's direction while exchanging the tip/base
           orientation, matching the semantic flag rather than mirroring
           the entire canvas. */
        [ax, s.ex] = [s.ex, ax];
        [ay, s.ey] = [s.ey, ay];
        [bx, s.ex] = [s.ex, bx];
        [by, s.ey] = [s.ey, by];
      }
      aTri(ctx, s.ex, s.ey, ax, ay, bx, by, s.color);
      break;
    }

    case NODE_TYPE.FILLED_CIRCLE: {
      const r = Math.max(Math.abs(len), Math.abs(s.thickness)) / 2;
      aCircle(ctx, s.ex, s.ey, r, s.color);
      break;
    }

    case NODE_TYPE.ELLIPSE: {
      const rx = Math.max(0.5, Math.abs(len) / 2);
      const ry = Math.max(0.5, Math.abs(s.thickness) / 2);
      aEllipse(ctx, s.ex, s.ey, rx, ry, angle - Math.PI / 2, s.color);
      break;
    }

    case NODE_TYPE.TRAPEZOID: {
      const w1 = s.trapStart > EPS ? Math.abs(s.trapStart) : Math.abs(s.thickness);
      const w2 = s.trapEnd > EPS ? Math.abs(s.trapEnd) : Math.abs(s.thickness) * 0.5;
      aTrap(ctx, s.sx, s.sy, s.ex, s.ey, w1, w2, s.color);
      break;
    }

    case NODE_TYPE.POLYGON: {
      const r = Math.max(1, Math.abs(len));
      aPoly(ctx, s.ex, s.ey, r, s.numPoly, angle, s.color);
      break;
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────
   WASM property access

   These helpers intentionally tolerate older/newer wrappers.  The JSON
   layer can therefore evolve without making the renderer unusable.
────────────────────────────────────────────────────────────────────── */

function safeGet(obj, name, fallback) {
  try {
    const v = obj?.[name];
    return v === undefined || v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function safeCall(obj, name, args = [], fallback = undefined) {
  try {
    if (typeof obj?.[name] !== "function") return fallback;
    const v = obj[name](...args);
    return v === undefined || v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function readHex(obj, name, fallback = "#000000") {
  try {
    const v = obj?.[name];
    if (typeof v === "string" && v) return v;
  } catch (_) {}
  return fallback;
}

function readPoint(obj, name) {
  const p = safeCall(obj, name, [], null);
  return finitePoint(p) ? [num(p[0]), num(p[1])] : null;
}

function getNodeColor(n) {
  return hexToRgba(safeCall(n, "getDisplayColorHex", [],
    readHex(n, "colorHex", "#000000")));
}

/* ──────────────────────────────────────────────────────────────────────
   Scene extraction

   IMPORTANT:
   - Root node is excluded.
   - Every drawable StickNode is rendered.
   - Editor handles are NOT derived from every drawable node.
   - Only type 0/1 limb nodes receive handles.
────────────────────────────────────────────────────────────────────── */

function extractScene(fig, showFills = true) {
  const figScale = Math.max(EPS, num(safeGet(fig, "scale", 1), 1));
  const all = safeCall(fig, "allNodes", [], []);
  const scene = [];
  const nodeByIndex = new Map();

  for (const n of Array.isArray(all) ? all : []) {
    const type = num(safeGet(n, "nodeType", -1), -1);
    if (type < 0 || type > 7) continue;

    const start = readPoint(n, "getGlobalStart");
    const end = readPoint(n, "getGlobalEnd");
    if (!start || !end) continue;

    const effectiveThickness = Math.abs(num(
      safeCall(n, "getEffectiveThickness", [], safeGet(n, "thickness", 1)), 1
    ));

    let gradientMode = num(safeGet(n, "gradientMode", 0), 0);
    let gradientAxis = gradientMode === 1 ? "y" : "x";

    const s = {
      node: n,
      type,
      drawIndex: num(safeGet(n, "drawIndex", scene.length), scene.length),

      /* getGlobalStart/getGlobalEnd are figure-space values. */
      sx: start[0] * figScale,
      sy: start[1] * figScale,
      ex: end[0] * figScale,
      ey: end[1] * figScale,

      thickness: effectiveThickness * figScale,
      color: getNodeColor(n),
      gradientColor: hexToRgba(readHex(n, "gradientColorHex", readHex(n, "colorHex", "#000000"))),

      useGradient: bool(safeGet(n, "useGradient", false)),
      reverseGradient: bool(safeGet(n, "reverseGradient", false)),
      gradientMode,
      gradientAxis,

      hollow: bool(safeGet(n, "circleIsHollow", false)),
      trapStart: num(safeGet(n, "trapezoidThicknessStart", 0), 0),
      trapEnd: num(safeGet(n, "trapezoidThicknessEnd", 0), 0),
      numPoly: Math.max(3, Math.floor(num(safeGet(n, "numPolygonVertices", 5), 5))),
      curveRadius: num(safeGet(n, "segmentCurveRadiusAndDefaultCurveRadius",
        safeGet(n, "curveRadius", 0)), 0),

      isLimb: LIMB_TYPES.has(type),
      isStatic: bool(safeGet(n, "isStatic", false)),
      isStretchy: bool(safeGet(n, "isStretchy", false)),
      isFloaty: bool(safeGet(n, "isFloaty", false)),
      isSmartStretch: bool(safeGet(n, "isSmartStretch", false)),
      useSegmentScale: bool(safeGet(n, "useSegmentScale", false)),
      segmentScale: num(safeGet(n, "scale", 1), 1),

      triangleFlipped: bool(safeGet(n, "triangleFlipped", false)),
      triangleUpsideDown: bool(safeGet(n, "triangleUpsideDown", false))
    };

    scene.push(s);
    nodeByIndex.set(s.drawIndex, s);
  }

  /* Polyfills are retained as their own render layer.  We do NOT put
     their anchor/attached points into the node-handle list. */
  const polyfills = [];
  if (showFills) {
    const pfs = safeCall(fig, "allPolyfills", [], []);
    for (const pf of Array.isArray(pfs) ? pfs : []) {
      const anchor = num(safeGet(pf, "anchorDrawIndex", -1), -1);
      if (anchor < 0) continue;

      let flat = safeCall(fig, "getPolyfillVertices", [anchor], null);
      if (!flat || flat.length < 6) continue;

      flat = Array.from(flat, Number).filter(Number.isFinite);
      if (flat.length < 6) continue;

      polyfills.push({
        anchorDrawIndex: anchor,
        flat,
        color: hexToRgba(readHex(pf, "colorHex", "#000000")),
        useColor: bool(safeGet(pf, "usePolyfillColor", false))
      });
    }
  }

  return { scene, polyfills, figScale, nodeByIndex };
}

/* ──────────────────────────────────────────────────────────────────────
   Polyfill rendering

   The Rust/WASM wrapper supplies EarClippingTriangulator output.  We
   render that triangulation directly, but first try to reconstruct its
   outer boundary.  Boundary rendering avoids the "triangle soup" look
   and avoids visible AA seams on large fills.

   If reconstruction fails, the triangle mesh is used as a safe fallback.
────────────────────────────────────────────────────────────────────── */

function vertexKey(x, y) {
  /* Quantization only for matching shared triangle edges. */
  return `${Math.round(x * 100000)}:${Math.round(y * 100000)}`;
}

function boundaryFromTriangles(flat) {
  const edges = new Map();

  function addEdge(ax, ay, bx, by) {
    const a = vertexKey(ax, ay), b = vertexKey(bx, by);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const old = edges.get(key);
    if (old) {
      edges.delete(key);
    } else {
      edges.set(key, { ax, ay, bx, by, a, b });
    }
  }

  for (let i = 0; i + 5 < flat.length; i += 6) {
    addEdge(flat[i], flat[i + 1], flat[i + 2], flat[i + 3]);
    addEdge(flat[i + 2], flat[i + 3], flat[i + 4], flat[i + 5]);
    addEdge(flat[i + 4], flat[i + 5], flat[i], flat[i + 1]);
  }

  if (!edges.size) return null;

  const adjacency = new Map();
  const put = (k, e) => {
    if (!adjacency.has(k)) adjacency.set(k, []);
    adjacency.get(k).push(e);
  };

  for (const e of edges.values()) {
    put(e.a, e);
    put(e.b, e);
  }

  const unused = new Set(edges.keys());
  const loops = [];

  while (unused.size) {
    const firstKey = unused.values().next().value;
    const first = edges.get(firstKey);
    if (!first) break;

    const loop = [[first.ax, first.ay]];
    let currentKey = first.a;
    let nextKey = first.b;
    let guard = 0;

    while (guard++ < edges.size + 4) {
      const key = vertexKey(
        currentKey.split(":")[0] / 100000,
        currentKey.split(":")[1] / 100000
      );

      /* The exact string key is already available from the edge. */
      const candidates = adjacency.get(currentKey) || [];
      let edge = null;
      let edgeKey = null;

      for (const e of candidates) {
        const k = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
        if (unused.has(k)) {
          edge = e;
          edgeKey = k;
          break;
        }
      }

      if (!edge) break;
      unused.delete(edgeKey);

      const next = edge.a === currentKey ? edge.b : edge.a;
      const parts = next.split(":");
      loop.push([Number(parts[0]) / 100000, Number(parts[1]) / 100000]);

      currentKey = next;
      if (currentKey === nextKey) break;
      nextKey = next;
    }

    if (loop.length >= 3) loops.push(loop);
  }

  if (!loops.length) return null;
  loops.sort((a, b) => b.length - a.length);
  return loops[0];
}

function drawPolyfill(ctx, pf, figScale, color) {
  const flat = pf.flat;
  if (!flat || flat.length < 6) return;

  const path = boundaryFromTriangles(flat);

  if (path && path.length >= 3) {
    const c = css(color);
    const dim = css(mulColor(color, 0.10));

    /* One continuous fill first. */
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(path[0][0] * figScale, path[0][1] * figScale);
    for (let i = 1; i < path.length; i++)
      ctx.lineTo(path[i][0] * figScale, path[i][1] * figScale);
    ctx.closePath();
    ctx.fill();

    /* Soft outer passes, but on the entire polygon instead of on each
       triangle. This is much cleaner than the previous triangle-by-
       triangle AA implementation. */
    ctx.save();
    for (let lv = 1; lv <= 5; lv++) {
      const ox = 0.14 * lv;
      for (const [dx, dy] of [
        [-ox, -ox], [-ox, 0], [-ox, ox],
        [0, -ox], [0, ox],
        [ox, -ox], [ox, 0], [ox, ox]
      ]) {
        ctx.translate(dx, dy);
        ctx.fillStyle = dim;
        ctx.beginPath();
        ctx.moveTo(path[0][0] * figScale, path[0][1] * figScale);
        for (let i = 1; i < path.length; i++)
          ctx.lineTo(path[i][0] * figScale, path[i][1] * figScale);
        ctx.closePath();
        ctx.fill();
        ctx.translate(-dx, -dy);
      }
    }
    ctx.restore();

    /* Restore crisp center pass after soft passes. */
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(path[0][0] * figScale, path[0][1] * figScale);
    for (let i = 1; i < path.length; i++)
      ctx.lineTo(path[i][0] * figScale, path[i][1] * figScale);
    ctx.closePath();
    ctx.fill();
    return;
  }

  /* Safe fallback: triangulated output exactly as provided by WASM. */
  const col = css(color);
  for (let i = 0; i + 5 < flat.length; i += 6) {
    pTri(ctx,
      flat[i] * figScale, flat[i + 1] * figScale,
      flat[i + 2] * figScale, flat[i + 3] * figScale,
      flat[i + 4] * figScale, flat[i + 5] * figScale,
      col);
  }
}

/* ──────────────────────────────────────────────────────────────────────
   JSON document model

   This is deliberately independent of the DOM/XML.  It describes the
   editable semantic state while WASM remains authoritative for derived
   global positions and native .nodes serialization.
────────────────────────────────────────────────────────────────────── */

const BOOL_PROPS = [
  "isStatic", "isStretchy", "isFloaty", "isSmartStretch",
  "doNotApplySmartStretch", "smartStretchResetImpulse",
  "useSegmentColor", "useCircleOutline", "circleIsHollow",
  "useGradient", "reverseGradient", "useSegmentScale",
  "curveCirculization", "halfArc", "triangleFlipped",
  "triangleUpsideDown", "trapezoidIsRoundedStart",
  "trapezoidIsRoundedEnd", "useTrapezoidThicknessStart",
  "useTrapezoidThicknessEnd", "isDragLocked", "isAngleLocked",
  "angleLockIsMainNode", "hasConnector"
];

const NUM_PROPS = [
  "length", "defaultLength", "thickness", "defaultThickness",
  "scale", "localAngle", "defaultLocalAngle", "defaultAngle",
  "curveRadius", "segmentCurveRadiusAndDefaultCurveRadius",
  "curvePrecision", "segmentCurvePolyfillPrecision",
  "numPolygonVertices", "polygonVertices",
  "trapezoidThicknessStart", "trapezoidThicknessEnd",
  "trapezoidThicknessRatio", "angleLockRelativeMultiplier",
  "dragLockAngle", "smartStretchMultiplier",
  "smartStretchResetImpulse", "angleLockOffset",
  "angleLockValue"
];

const ENUM_PROPS = [
  "gradientMode", "triangleType", "angleLockMode"
];

const COLOR_PROPS = [
  "colorHex", "gradientColorHex", "circleOutlineColorHex", "polyfillColorHex"
];

function readNodeJSON(n, s) {
  const properties = {};

  for (const k of BOOL_PROPS) {
    const v = safeGet(n, k, undefined);
    if (v !== undefined) properties[k] = !!v;
  }

  for (const k of NUM_PROPS) {
    const v = safeGet(n, k, undefined);
    if (v !== undefined && Number.isFinite(Number(v)))
      properties[k] = Number(v);
  }

  for (const k of ENUM_PROPS) {
    const v = safeGet(n, k, undefined);
    if (v !== undefined && Number.isFinite(Number(v)))
      properties[k] = Number(v);
  }

  for (const k of COLOR_PROPS) {
    const v = safeGet(n, k, undefined);
    if (typeof v === "string" && v) properties[k] = v;
  }

  const connector = {
    endIndex: safeCall(n, "getConnectorEndIndex", [], -1),
    percent: safeCall(n, "getConnectorPercent", [], 0),
    method: safeCall(n, "getConnectorMethod", [], 0)
  };

  const locks = {
    parentIndex: safeCall(n, "getParentIndex", [], -1),
    siblingIndices: safeCall(n, "getSiblingIndices", [], []),
    ancestorIndices: safeCall(n, "getAncestorIndices", [], []),
    descendantIndices: safeCall(n, "getDescendantIndices", [], [])
  };

  return {
    id: s.drawIndex,
    type: s.type,
    parent: num(locks.parentIndex, -1),
    properties,
    connector,
    transform: {
      globalStart: [s.sx / (s.figScale || 1), s.sy / (s.figScale || 1)],
      globalEnd: [s.ex / (s.figScale || 1), s.ey / (s.figScale || 1)],
      globalAngle: safeCall(n, "getGlobalAngle", [], 0)
    }
  };
}

function readPolyfillJSON(pf) {
  return {
    anchorDrawIndex: pf.anchorDrawIndex,
    attached: safeGet(pf, "attached", safeGet(pf, "attachedDrawIndices", [])),
    colorHex: readHex(pf, "colorHex", "#000000"),
    usePolyfillColor: bool(safeGet(pf, "usePolyfillColor", false))
  };
}

export function figureToJSON(fig, options = {}) {
  if (!fig) throw new Error("figureToJSON: figure is required");

  const scene = extractScene(fig, true);
  const nodes = scene.scene.map(s => readNodeJSON(s.node, {
    ...s,
    figScale: scene.figScale
  }));

  const pfs = safeCall(fig, "allPolyfills", [], []);
  const polyfills = (Array.isArray(pfs) ? pfs : []).map(readPolyfillJSON);

  return {
    schema: "sticknodes-web",
    schemaVersion: 1,
    native: {
      version: safeCall(fig, "version", [], safeGet(fig, "version", 0)),
      build: safeCall(fig, "build", [], safeGet(fig, "build", 0))
    },
    figure: {
      scale: num(safeGet(fig, "scale", 1), 1),
      colorHex: readHex(fig, "colorHex", "#202020"),
      nodeLimitEnabled: bool(safeCall(fig, "isNodeLimitEnabled", [],
        safeGet(fig, "nodeLimitEnabled", true)), true),
      nodes,
      polyfills
    },
    renderer: {
      source: "sticknodes-rs",
      coordinateSystem: "Y-down"
    }
  };
}

export function jsonStringifyFigure(fig, pretty = true) {
  return JSON.stringify(figureToJSON(fig), null, pretty ? 2 : 0);
}

/* ──────────────────────────────────────────────────────────────────────
   JSON -> WASM figure

   The JSON format is our web/editor format.  This function uses the
   existing WASM API when possible.  Unknown properties are preserved in
   the JSON model but are not blindly assigned to WASM objects.
────────────────────────────────────────────────────────────────────── */

function setIfWritable(obj, key, value) {
  try {
    if (key in obj || Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(obj) || {}, key)) {
      obj[key] = value;
      return true;
    }
  } catch (_) {}
  return false;
}

function applyJSONNodeProperties(n, properties) {
  for (const [k, v] of Object.entries(properties || {})) {
    setIfWritable(n, k, v);
  }

  /* Some wrappers expose more stable aliases. */
  if (properties?.colorHex) setIfWritable(n, "colorHex", properties.colorHex);
  if (properties?.gradientColorHex)
    setIfWritable(n, "gradientColorHex", properties.gradientColorHex);
}

export function jsonToFigure(json, StickfigureClass) {
  if (!json || typeof json !== "object")
    throw new Error("jsonToFigure: invalid JSON document");

  const F = StickfigureClass;
  if (!F) throw new Error("jsonToFigure: Stickfigure class is required");

  const root = json.figure || json;
  const native = json.native || {};

  let fig;
  if (typeof F.fromVersionAndBuild === "function") {
    fig = F.fromVersionAndBuild(
      num(native.version, 1),
      num(native.build, 0)
    );
  } else if (typeof F.new === "function") {
    fig = F.new();
  } else {
    throw new Error("WASM Stickfigure constructor is unavailable");
  }

  if (root.scale !== undefined) setIfWritable(fig, "scale", num(root.scale, 1));
  if (root.colorHex) setIfWritable(fig, "colorHex", root.colorHex);

  if (typeof fig.setNodeLimitEnabled === "function")
    fig.setNodeLimitEnabled(root.nodeLimitEnabled !== false);

  const byId = new Map();
  const rootNode = safeGet(fig, "rootNode", null);
  if (rootNode) byId.set(-1, rootNode);

  const nodes = Array.isArray(root.nodes) ? root.nodes : [];

  /* Parent-before-child creation.  The JSON exporter uses parent IDs,
     so arbitrary array ordering is supported. */
  const pending = nodes.slice();
  let safety = 0;

  while (pending.length && safety++ < nodes.length * 3 + 10) {
    let progress = false;

    for (let i = pending.length - 1; i >= 0; i--) {
      const d = pending[i];
      const parentId = num(d.parent, -1);
      const parent = byId.get(parentId);
      if (!parent) continue;

      let n = null;
      if (typeof parent.addChild === "function") {
        n = parent.addChild();
      }
      if (!n && typeof fig.addNode === "function") n = fig.addNode(parentId);
      if (!n) {
        pending.splice(i, 1);
        continue;
      }

      applyJSONNodeProperties(n, d.properties || {});

      if (d.properties?.localAngle !== undefined)
        setIfWritable(n, "localAngle", d.properties.localAngle);
      if (d.properties?.length !== undefined)
        setIfWritable(n, "length", d.properties.length);

      const newId = num(safeGet(n, "drawIndex", d.id), d.id);
      byId.set(d.id, n);
      byId.set(newId, n);
      pending.splice(i, 1);
      progress = true;
    }

    if (!progress) break;
  }

  /* Restore polyfills through the wrapper if available. */
  for (const p of Array.isArray(root.polyfills) ? root.polyfills : []) {
    try {
      if (typeof fig.addPolyfill === "function")
        fig.addPolyfill(
          num(p.anchorDrawIndex, -1),
          Array.isArray(p.attached) ? p.attached : [],
          p.colorHex || "#000000",
          !!p.usePolyfillColor
        );
    } catch (_) {}
  }

  return fig;
}

/* ──────────────────────────────────────────────────────────────────────
   Renderer
────────────────────────────────────────────────────────────────────── */

export class StickNodesRenderer {
  constructor(canvas) {
    if (!canvas) throw new Error("StickNodesRenderer: canvas required");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true
    });
    if (!this.ctx) throw new Error("Canvas 2D context unavailable");

    this.fig = null;
    this.showFills = true;
    this.showPoints = true;
    this.showLimbPointsOnly = true;
    this.flipY = false;
    this.dragEnabled = true;

    this.view = {
      cx: 0, cy: 0, zoom: 1, fitted: false
    };

    this.sceneCache = null;
    this._onNodeChanged = null;
    this._onSelect = null;

    this.pointers = new Map();
    this.activeDrag = null;
    this.activePan = null;
    this.pinch = null;
    this.lastTap = 0;
    this.selectedIndex = null;

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._wheel = this._wheel.bind(this);

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    canvas.addEventListener("pointercancel", this._up);
    canvas.addEventListener("wheel", this._wheel, { passive: false });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  setFigure(fig) {
    this.fig = fig || null;
    this.view.fitted = false;
    this.sceneCache = null;
    this.selectedIndex = null;
    this.activeDrag = null;
  }

  setFills(v) {
    this.showFills = !!v;
    this.sceneCache = null;
  }

  setShowPoints(v) {
    this.showPoints = !!v;
  }

  /* Explicit API requested for editor handles. */
  setShowLimbPointsOnly(v) {
    this.showLimbPointsOnly = !!v;
  }

  setFlipY(v) {
    this.flipY = !!v;
  }

  setDragEnabled(v) {
    this.dragEnabled = !!v;
  }

  onNodeChanged(fn) {
    this._onNodeChanged = typeof fn === "function" ? fn : null;
  }

  onSelect(fn) {
    this._onSelect = typeof fn === "function" ? fn : null;
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  getSelectedNode() {
    if (!this.fig || this.selectedIndex == null) return null;
    try {
      return this.fig.getNode(this.selectedIndex);
    } catch (_) {
      return null;
    }
  }

  invalidate() {
    this.sceneCache = null;
  }

  getJSON() {
    return this.fig ? figureToJSON(this.fig) : null;
  }

  getJSONString(pretty = true) {
    return this.fig ? jsonStringifyFigure(this.fig, pretty) : "";
  }

  /* ── sizing ──────────────────────────────────────────────────────── */

  _ensureSize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth || this.canvas.clientWidth || 640);
    const h = Math.max(1, parent?.clientHeight || this.canvas.clientHeight || 480);
    const tw = Math.floor(w * dpr);
    const th = Math.floor(h * dpr);

    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width = tw;
      this.canvas.height = th;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.view.fitted = false;
    }
  }

  _getScene() {
    if (!this.sceneCache && this.fig)
      this.sceneCache = extractScene(this.fig, this.showFills);
    return this.sceneCache;
  }

  /* ── view / bounds ───────────────────────────────────────────────── */

  fitView() {
    if (!this.fig) return;

    const cache = this._getScene();
    if (!cache) return;

    const { scene, polyfills, figScale } = cache;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const include = (x, y, pad = 0) => {
      minX = Math.min(minX, x - pad);
      minY = Math.min(minY, y - pad);
      maxX = Math.max(maxX, x + pad);
      maxY = Math.max(maxY, y + pad);
    };

    for (const s of scene) {
      const dx = s.ex - s.sx, dy = s.ey - s.sy;
      const len = Math.hypot(dx, dy);
      let pad = Math.max(Math.abs(s.thickness), 1) / 2;

      if (s.curveRadius) pad += Math.min(Math.abs(s.curveRadius), len + Math.abs(s.thickness));
      include(s.sx, s.sy, pad);
      include(s.ex, s.ey, pad);
    }

    for (const pf of polyfills) {
      for (let i = 0; i + 1 < pf.flat.length; i += 2) {
        include(pf.flat[i] * figScale, pf.flat[i + 1] * figScale, 1);
      }
    }

    if (!Number.isFinite(minX)) {
      minX = minY = -50;
      maxX = maxY = 50;
    }

    const pad = 10;
    minX -= pad; minY -= pad;
    maxX += pad; maxY += pad;

    const spanX = Math.max(maxX - minX, 40);
    const spanY = Math.max(maxY - minY, 40);

    const W = this.canvas.width;
    const H = this.canvas.height;

    /* PreviewStickfigureDialog uses a generous frame rather than
       touching the edges.  90% keeps figures readable on phones. */
    this.view.zoom = Math.max(0.001,
      Math.min((W * 0.90) / spanX, (H * 0.90) / spanY));

    this.view.cx = (minX + maxX) / 2;
    this.view.cy = (minY + maxY) / 2;
    this.view.fitted = true;
  }

  resetView() {
    this.view.cx = 0;
    this.view.cy = 0;
    this.view.zoom = 1;
    this.view.fitted = true;
  }

  zoomBy(factor, pivotX, pivotY) {
    if (!this.view.zoom) this.view.zoom = 1;

    const W = this.canvas.width, H = this.canvas.height;
    if (pivotX === undefined) {
      pivotX = W / 2;
      pivotY = H / 2;
    }

    const wx = (pivotX - W / 2) / this.view.zoom + this.view.cx;
    const wy = (pivotY - H / 2) / this.view.zoom + this.view.cy;

    this.view.zoom = clamp(
      this.view.zoom * num(factor, 1), 0.001, 1000
    );

    this.view.cx = wx - (pivotX - W / 2) / this.view.zoom;
    this.view.cy = wy - (pivotY - H / 2) / this.view.zoom;
  }

  /* ── render ───────────────────────────────────────────────────────── */

  render() {
    if (!this.fig) return null;

    this._ensureSize();

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (!this.view.fitted) this.fitView();

    const cache = this._getScene();
    if (!cache) return null;

    const { scene, polyfills, figScale } = cache;
    const zoom = this.view.zoom || 1;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, this.flipY ? -zoom : zoom);
    ctx.translate(-this.view.cx, -this.view.cy);

    /* Draw geometry in draw order. */
    for (const s of scene) drawNode(ctx, s);

    /* Polyfills are a separate layer and never become handles. */
    let figColor = hexToRgba(readHex(this.fig, "colorHex", "#202020"));
    for (const pf of polyfills) {
      const c = pf.useColor ? pf.color : figColor;
      drawPolyfill(ctx, pf, figScale, c);
    }

    /* Editor handles: ONLY limb nodes.  No polyfill points, no solid
       polygon/circle/triangle/ellipse handles. */
    if (this.showPoints) {
      const handleRadius = 7 / zoom;
      const ringWidth = 1.6 / zoom;
      const selected = this.selectedIndex;

      for (const s of scene) {
        if (this.showLimbPointsOnly && !s.isLimb) continue;

        ctx.beginPath();
        ctx.arc(s.ex, s.ey, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.ex, s.ey,
          Math.max(0.5, handleRadius - ringWidth),
          0, Math.PI * 2);
        ctx.fillStyle = s.drawIndex === selected ? "#4f46e5" : css(s.color);
        ctx.fill();

        if (s.drawIndex === selected) {
          ctx.beginPath();
          ctx.arc(s.ex, s.ey, handleRadius + 2.5 / zoom,
            0, Math.PI * 2);
          ctx.strokeStyle = "#4f46e5";
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
        }
      }
    }

    ctx.restore();

    return {
      zoom,
      nodeCount: scene.length,
      limbNodeCount: scene.filter(s => s.isLimb).length,
      fillCount: polyfills.length
    };
  }

  /* ── coordinates ────────────────────────────────────────────────── */

  _screenToWorld(px, py) {
    const W = this.canvas.width, H = this.canvas.height;
    const x = (px - W / 2) / this.view.zoom + this.view.cx;
    const sy = (py - H / 2) / this.view.zoom;
    const y = (sy + this.view.cy) * (this.flipY ? -1 : 1);
    return { x, y };
  }

  _eventPos(ev) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (this.canvas.width / Math.max(r.width, 1)),
      y: (ev.clientY - r.top) * (this.canvas.height / Math.max(r.height, 1))
    };
  }

  /* ── hit testing: limb endpoints only ───────────────────────────── */

  _hitNode(px, py) {
    if (!this.fig) return null;

    const world = this._screenToWorld(px, py);
    const cache = this._getScene();
    if (!cache) return null;

    let best = null;
    let bestDist = Infinity;

    for (const s of cache.scene) {
      if (this.showLimbPointsOnly && !s.isLimb) continue;

      const d = Math.hypot(world.x - s.ex, world.y - s.ey);
      const tol = Math.max(20 / Math.max(this.view.zoom, 0.001),
        Math.abs(s.thickness) * 0.75);

      if (d < tol && d < bestDist) {
        best = s.node;
        bestDist = d;
      }
    }

    return best;
  }

  /* ── pointer interaction ─────────────────────────────────────────── */

  _down(ev) {
    this._ensureSize();

    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });

    try { this.canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    if (this.pointers.size === 1) {
      const hit = this._hitNode(p.x, p.y);

      if (this.dragEnabled && hit) {
        let start = readPoint(hit, "getGlobalStart");
        if (!start) start = [0, 0];

        const figScale = num(safeGet(this.fig, "scale", 1), 1);
        let parentAngle = 0;

        const pi = num(safeCall(hit, "getParentIndex", [], -1), -1);
        if (pi >= 0) {
          try {
            parentAngle = num(
              safeCall(this.fig.getNode(pi), "getGlobalAngle", [], 0), 0
            );
          } catch (_) {}
        }

        this.activeDrag = {
          node: hit,
          pivot: [start[0] * figScale, start[1] * figScale],
          parentAngle,
          figScale
        };
        this.selectedIndex = num(safeGet(hit, "drawIndex", null), null);
      } else {
        const now = Date.now();

        if (now - this.lastTap < 320) {
          this.lastTap = 0;
          this.fitView();
          this.render();
          this.pointers.delete(ev.pointerId);
          return;
        }

        this.lastTap = now;
        this.activePan = { lastX: p.x, lastY: p.y };
      }

      ev.preventDefault();
    } else if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;

      this.pinch = {
        startDist: Math.max(Math.hypot(dx, dy), 0.001),
        startZoom: this.view.zoom,
        startCx: this.view.cx,
        startCy: this.view.cy
      };

      this.activeDrag = null;
      this.activePan = null;
    }
  }

  _move(ev) {
    if (!this.pointers.has(ev.pointerId)) return;

    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });

    if (this.pointers.size === 2 && this.pinch) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.max(Math.hypot(dx, dy), 0.001);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const newZoom = clamp(
        this.pinch.startZoom * dist / this.pinch.startDist,
        0.001, 1000
      );

      const W = this.canvas.width, H = this.canvas.height;
      const wx = (midX - W / 2) / this.pinch.startZoom + this.pinch.startCx;
      const wy = (midY - H / 2) / this.pinch.startZoom + this.pinch.startCy;

      this.view.zoom = newZoom;
      this.view.cx = wx - (midX - W / 2) / newZoom;
      this.view.cy = wy - (midY - H / 2) / newZoom;

      this.render();
      return;
    }

    if (this.activeDrag && this.fig) {
      const world = this._screenToWorld(p.x, p.y);
      const pivot = this.activeDrag.pivot;

      const dx = world.x - pivot[0];
      const dy = world.y - pivot[1];
      if (Math.hypot(dx, dy) < 0.01) return;

      const node = this.activeDrag.node;
      const globalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

      /* IMPORTANT:
         StickNode.dragTo() already implements:
           - stretchy length
           - local/global angle conversion
           - angle locks
           - drag locks
           - smart stretch
           - joined sprite behavior
           - position invalidation

         Prefer it over duplicating those rules in JavaScript. */
      let changed = false;

      try {
        if (typeof node.dragTo === "function") {
          node.dragTo(world.x / this.activeDrag.figScale,
            world.y / this.activeDrag.figScale);
          changed = true;
        }
      } catch (_) {}

      /* Compatibility fallback for older wrappers. */
      if (!changed) {
        try {
          setIfWritable(node, "localAngle",
            globalAngleDeg - this.activeDrag.parentAngle);

          if (bool(safeGet(node, "isStretchy", false))) {
            const segScale = bool(safeGet(node, "useSegmentScale", false))
              ? Math.max(EPS, num(safeGet(node, "scale", 1), 1)) : 1;
            setIfWritable(node, "length",
              Math.hypot(dx, dy) / this.activeDrag.figScale / segScale);
          }
          changed = true;
        } catch (_) {}
      }

      if (!changed) return;

      this.sceneCache = null;
      this.render();

      if (this._onNodeChanged)
        this._onNodeChanged(node);

      return;
    }

    if (this.activePan) {
      const flip = this.flipY ? -1 : 1;

      this.view.cx -= (p.x - this.activePan.lastX) / this.view.zoom;
      this.view.cy -= ((p.y - this.activePan.lastY) / this.view.zoom) /
        this.view.zoom * flip;

      this.activePan.lastX = p.x;
      this.activePan.lastY = p.y;
      this.render();
    }
  }

  _up(ev) {
    const had = this.pointers.has(ev.pointerId);
    this.pointers.delete(ev.pointerId);

    try { this.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

    if (had && !this.activeDrag && !this.activePan &&
        this.pointers.size === 0) {
      const p = this._eventPos(ev);
      const hit = this._hitNode(p.x, p.y);

      this.selectedIndex = hit
        ? num(safeGet(hit, "drawIndex", null), null)
        : null;

      if (this._onSelect) this._onSelect(hit || null);
      this.render();
    }

    if (this.pointers.size < 2) this.pinch = null;

    if (this.pointers.size === 0) {
      this.activeDrag = null;
      this.activePan = null;
    }
  }

  _wheel(ev) {
    ev.preventDefault();
    const p = this._eventPos(ev);
    this.zoomBy(ev.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    this.render();
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._down);
    this.canvas.removeEventListener("pointermove", this._move);
    this.canvas.removeEventListener("pointerup", this._up);
    this.canvas.removeEventListener("pointercancel", this._up);
    this.canvas.removeEventListener("wheel", this._wheel);
    this.pointers.clear();
    this.fig = null;
    this.sceneCache = null;
  }
}

/* Optional default export for simple browser imports. */
export default StickNodesRenderer;