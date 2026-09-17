/* ══════════════════════════════════════════════════════════════════════
   ren.js — StickNodes Canvas renderer + JSON document layer
   .nodes ↔ WASM ↔ JSON (our format) ↔ Canvas
   Coordinates: StickNodes world, Y-down.
   ══════════════════════════════════════════════════════════════════════ */

export const NODE_TYPE = Object.freeze({
  RoundedSegment: 0, Segment: 1, Circle: 2, Triangle: 3,
  FilledCircle: 4, Ellipse: 5, Trapezoid: 6, Polygon: 7,
  ROUNDED_SEGMENT: 0, SEGMENT: 1, CIRCLE: 2, TRIANGLE: 3,
  FILLED_CIRCLE: 4, ELLIPSE: 5, TRAPEZOID: 6, POLYGON: 7,
});

const LIMB_TYPES = new Set([0, 1]);
const EPS = 1e-7;
const TYPE_NAME_TO_INT = {
  RoundedSegment: 0, Segment: 1, Circle: 2, Triangle: 3,
  FilledCircle: 4, Ellipse: 5, Trapezoid: 6, Polygon: 7,
};
const TYPE_INT_TO_NAME = [
  "RoundedSegment","Segment","Circle","Triangle",
  "FilledCircle","Ellipse","Trapezoid","Polygon"
];

/* ── basic helpers ───────────────────────────────────────────────── */
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function bool(v, d = false) {
  if (v === undefined || v === null) return d;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return d;
}
function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function finitePoint(p) {
  return Array.isArray(p) && p.length >= 2 &&
    Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

/* ── colors ──────────────────────────────────────────────────────── */
export function hexToRgba(hex) {
  let h = String(hex ?? "#000000").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map(c => c + c).join("") + "FF";
  else if (/^[0-9a-fA-F]{4}$/.test(h)) h = h.split("").map(c => c + c).join("");
  else if (/^[0-9a-fA-F]{6}$/.test(h)) h += "FF";
  else if (!/^[0-9a-fA-F]{8}$/.test(h)) h = "000000FF";
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  };
}
export function rgbaToHex(c) {
  const h = n => Math.max(0, Math.min(255, Math.round(num(n)))).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${h(c.a)}`;
}
export function hexToWasmColor(hex) {
  const c = hexToRgba(hex);
  return { red: c.r, green: c.g, blue: c.b, alpha: c.a };
}
function mulColor(c, m) { return { r: c.r*m, g: c.g*m, b: c.b*m, a: c.a*m }; }
function css(c) {
  return `rgba(${c.r|0},${c.g|0},${c.b|0},${clamp(c.a/255, 0, 1)})`;
}
function lerpColor(a, b, t) {
  t = clamp(t);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

/* ── interpolation ───────────────────────────────────────────────── */
function sineIn(t) { return 1 - Math.cos((clamp(t) * Math.PI) / 2); }
function sineOut(t) { return Math.sin((clamp(t) * Math.PI) / 2); }
function gradientT(t, reverse = false, mode = 0) {
  let x = clamp(t);
  if (mode === 1) x = sineIn(x);
  else if (mode === 2) x = sineOut(x);
  return reverse ? 1 - x : x;
}
function aaParams(m) { return Math.max(2, Math.floor((m < 80 ? m/80 : 1) * 6)); }

/* ── primitives ──────────────────────────────────────────────────── */
function pSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function pRSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function pCircle(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(Math.abs(r), 0.01), 0, Math.PI*2); ctx.fill();
}
function pRing(ctx, cx, cy, ro, ri, col) {
  const outer = Math.max(Math.abs(ro), 0.01);
  const inner = Math.max(0, Math.min(outer - EPS, Math.abs(ri)));
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI*2, false);
  if (inner > EPS) ctx.arc(cx, cy, inner, 0, Math.PI*2, true);
  ctx.fill("evenodd");
}
function pEllipse(ctx, cx, cy, rx, ry, ang, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") {
    ctx.ellipse(cx, cy, Math.max(Math.abs(rx),0.01), Math.max(Math.abs(ry),0.01), ang, 0, Math.PI*2);
  } else {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.scale(Math.max(Math.abs(rx),0.01), Math.max(Math.abs(ry),0.01));
    ctx.arc(0, 0, 1, 0, Math.PI*2); ctx.restore();
  }
  ctx.fill();
}
function pTri(ctx, x1, y1, x2, y2, x3, y3, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath(); ctx.fill();
}
function pPoly(ctx, cx, cy, r, n, ang, col) {
  n = Math.max(3, Math.floor(num(n, 5)));
  r = Math.max(Math.abs(r), 0.01);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + i * Math.PI*2 / n;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}
function pTrap(ctx, x1, y1, x2, y2, w1, w2, col) {
  const dx = x2-x1, dy = y2-y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy/len, ny = dx/len;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1 + nx*w1/2, y1 + ny*w1/2);
  ctx.lineTo(x2 + nx*w2/2, y2 + ny*w2/2);
  ctx.lineTo(x2 - nx*w2/2, y2 - ny*w2/2);
  ctx.lineTo(x1 - nx*w1/2, y1 - ny*w1/2);
  ctx.closePath(); ctx.fill();
}

/* ── curved segment ─────────────────────────────────────────────── */
function curveInfo(x1, y1, x2, y2, radius) {
  const dx = x2-x1, dy = y2-y1;
  const chord = Math.hypot(dx, dy);
  const R = Math.abs(num(radius));
  if (chord < EPS || R < chord/2 + EPS) return null;
  const half = chord/2;
  const sag = Math.sqrt(Math.max(0, R*R - half*half));
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  const nx = -dy/chord, ny = dx/chord;
  const sign = num(radius) >= 0 ? 1 : -1;
  const ccx = mx + nx*sag*sign, ccy = my + ny*sag*sign;
  let a1 = Math.atan2(y1-ccy, x1-ccx);
  let a2 = Math.atan2(y2-ccy, x2-ccx);
  let da = a2 - a1;
  if (sign > 0) { while (da < 0) da += Math.PI*2; if (da > Math.PI) da -= Math.PI*2; }
  else { while (da > 0) da -= Math.PI*2; if (da < -Math.PI) da += Math.PI*2; }
  return { cx: ccx, cy: ccy, R, a1, a2: a1+da, da };
}
function aCurvedSegment(ctx, x1, y1, x2, y2, th, radius, c, rounded) {
  const info = curveInfo(x1, y1, x2, y2, radius);
  if (!info) { rounded ? aRSeg(ctx, x1, y1, x2, y2, th, c) : aSeg(ctx, x1, y1, x2, y2, th, c); return; }
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.max(Math.abs(th), info.R * Math.abs(info.da)));
  const grow = rounded ? 0.14 : 0.18666667;
  for (let i = 1; i <= N; i++) {
    ctx.strokeStyle = dim;
    ctx.lineWidth = Math.max(th + grow*i, 0.01);
    ctx.lineCap = rounded ? "round" : "butt";
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
    ctx.stroke();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = rounded ? "round" : "butt";
  ctx.beginPath();
  ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
  ctx.stroke();
}

/* ── AA wrappers ────────────────────────────────────────────────── */
function aRSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const len = Math.hypot(x2-x1, y2-y1);
  const N = aaParams(Math.max(Math.abs(th), len));
  let g = 0;
  for (let i = 0; i < N; i++) { g += 0.14; pRSeg(ctx, x1, y1, x2, y2, th+g, dim); }
  pRSeg(ctx, x1, y1, x2, y2, th, col);
}
function aSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy);
  const ca = len > EPS ? dx/len : 1, sa = len > EPS ? dy/len : 0;
  const N = aaParams(Math.max(Math.abs(th), len));
  let g = 0;
  for (let i = 0; i < N; i++) {
    g += 0.18666667; const h = g*0.5;
    pSeg(ctx, x1-ca*h, y1-sa*h, x2+ca*h, y2+sa*h, th+g, dim);
  }
  pSeg(ctx, x1, y1, x2, y2, th, col);
}
function aCircle(ctx, cx, cy, r, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(r));
  let g = 0;
  for (let i = 0; i < N; i++) { g += 0.093333334; pCircle(ctx, cx, cy, r+g, dim); }
  pCircle(ctx, cx, cy, r, col);
}
function aRing(ctx, cx, cy, ro, ri, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(ro));
  let g = 0;
  for (let i = 0; i < N; i++) { g += 0.093333334; pRing(ctx, cx, cy, ro+g, ri+g, dim); }
  pRing(ctx, cx, cy, ro, ri, col);
}
function aEllipse(ctx, cx, cy, rx, ry, ang, c) {
  const col = css(c), dim = css(mulColor(c, 0.1));
  const jb = 0.42 * Math.min(Math.max(Math.abs(rx), Math.abs(ry)) / 128, 1);
  for (let lv = 1; lv <= 5; lv++)
    for (let jx = -1; jx <= 1; jx++)
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        pEllipse(ctx, cx+jx*0.5*jb*lv, cy+jy*0.5*jb*lv, rx, ry, ang, dim);
      }
  pEllipse(ctx, cx, cy, rx, ry, ang, col);
}
function aTri(ctx, x1, y1, x2, y2, x3, y3, c) {
  const col = css(c), dim = css(mulColor(c, 0.1));
  const jb = 0.28;
  for (let lv = 1; lv <= 5; lv++)
    for (let jx = -1; jx <= 1; jx++)
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
        pTri(ctx, x1+ox, y1+oy, x2+ox, y2+oy, x3+ox, y3+oy, dim);
      }
  pTri(ctx, x1, y1, x2, y2, x3, y3, col);
}
function aTrap(ctx, x1, y1, x2, y2, w1, w2, c) {
  const col = css(c), dim = css(mulColor(c, 0.1));
  const jb = 0.42 * Math.min(Math.max(Math.abs(w1), Math.abs(w2)) / 80, 1);
  for (let lv = 1; lv <= 5; lv++)
    for (let jx = -1; jx <= 1; jx++)
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        ctx.save();
        ctx.translate(jx*0.5*jb*lv, jy*0.5*jb*lv);
        pTrap(ctx, x1, y1, x2, y2, w1, w2, dim);
        ctx.restore();
      }
  pTrap(ctx, x1, y1, x2, y2, w1, w2, col);
}
function aPoly(ctx, cx, cy, r, n, ang, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(r));
  let g = 0;
  for (let i = 0; i < N; i++) { g += 0.23333333; pPoly(ctx, cx, cy, r+g, n, ang, dim); }
  pPoly(ctx, cx, cy, r, n, ang, col);
}

/* ── gradient segment ───────────────────────────────────────────── */
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
  const stops = 8;
  for (let i = 0; i <= stops; i++) {
    const raw = i / stops;
    const t = gradientT(raw, reverse, mode);
    g.addColorStop(raw, css(lerpColor(c1, c2, t)));
  }
  return g;
}
function drawGradientSegment(ctx, s) {
  const c1 = s.color, c2 = s.gradientColor || s.color;
  const info = s.curveRadius ? curveInfo(s.sx, s.sy, s.ex, s.ey, s.curveRadius) : null;
  ctx.save();
  ctx.strokeStyle = segmentGradient(ctx, s.sx, s.sy, s.ex, s.ey,
    c1, c2, s.gradientAxis, s.reverseGradient, s.gradientMode);
  ctx.lineWidth = Math.max(Math.abs(s.thickness), 0.01);
  ctx.lineCap = s.type === 0 ? "round" : "butt";
  ctx.lineJoin = "round";
  if (info) {
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
    ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.ex, s.ey); ctx.stroke();
  }
  ctx.restore();
}

/* ── node dispatch ──────────────────────────────────────────────── */
function drawNode(ctx, s) {
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  if (s.useGradient && (s.type === 0 || s.type === 1)) {
    drawGradientSegment(ctx, s);
    return;
  }
  switch (s.type) {
    case 0:
      aCurvedSegment(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color, true);
      break;
    case 1:
      aCurvedSegment(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color, false);
      break;
    case 2: {
      const innerR = Math.max(0, s.thickness/2);
      const outerR = Math.max(innerR, (Math.abs(len) + Math.abs(s.thickness))/2);
      if (s.hollow) aRing(ctx, s.ex, s.ey, outerR, innerR, s.color);
      else aCircle(ctx, s.ex, s.ey, outerR, s.color);
      break;
    }
    case 3: {
      const halfBase = Math.max(Math.abs(s.thickness), 0.01) / 2;
      const ux = len > EPS ? dx/len : 1, uy = len > EPS ? dy/len : 0;
      const px = -uy, py = ux;
      let ax = s.sx + px*halfBase, ay = s.sy + py*halfBase;
      let bx = s.sx - px*halfBase, by = s.sy - py*halfBase;
      if (s.triangleFlipped) { [ax,bx]=[bx,ax]; [ay,by]=[by,ay]; }
      if (s.triangleUpsideDown) {
        [ax,s.ex]=[s.ex,ax]; [ay,s.ey]=[s.ey,ay];
        [bx,s.ex]=[s.ex,bx]; [by,s.ey]=[s.ey,by];
      }
      aTri(ctx, s.ex, s.ey, ax, ay, bx, by, s.color);
      break;
    }
    case 4: {
      const r = Math.max(Math.abs(len), Math.abs(s.thickness)) / 2;
      aCircle(ctx, s.ex, s.ey, r, s.color);
      break;
    }
    case 5: {
      const rx = Math.max(0.5, Math.abs(len)/2);
      const ry = Math.max(0.5, Math.abs(s.thickness)/2);
      aEllipse(ctx, s.ex, s.ey, rx, ry, angle - Math.PI/2, s.color);
      break;
    }
    case 6: {
      const w1 = s.trapStart > EPS ? Math.abs(s.trapStart) : Math.abs(s.thickness);
      const w2 = s.trapEnd > EPS ? Math.abs(s.trapEnd) : Math.abs(s.thickness)*0.5;
      aTrap(ctx, s.sx, s.sy, s.ex, s.ey, w1, w2, s.color);
      break;
    }
    case 7: {
      const r = Math.max(1, Math.abs(len));
      aPoly(ctx, s.ex, s.ey, r, s.numPoly, angle, s.color);
      break;
    }
  }
}

/* ── WASM property helpers ──────────────────────────────────────── */
function safeGet(obj, name, d) {
  try { const v = obj?.[name]; return v === undefined || v === null ? d : v; }
  catch (_) { return d; }
}
function safeCall(obj, name, args = [], d) {
  try {
    if (typeof obj?.[name] !== "function") return d;
    const v = obj[name](...args);
    return v === undefined || v === null ? d : v;
  } catch (_) { return d; }
}
function readHex(obj, name, d = "#000000") {
  try { const v = obj?.[name]; if (typeof v === "string" && v) return v; }
  catch (_) {}
  return d;
}
function readPoint(obj, name) {
  const p = safeCall(obj, name, [], null);
  return finitePoint(p) ? [num(p[0]), num(p[1])] : null;
}
function getNodeColor(n) {
  return hexToRgba(safeCall(n, "getDisplayColorHex", [],
    readHex(n, "colorHex", "#000000")));
}

/* ── scene extraction ───────────────────────────────────────────── */
function extractScene(fig, showFills = true) {
  const figScale = Math.max(EPS, num(safeGet(fig, "scale", 1), 1));
  const all = safeCall(fig, "allNodes", [], []);
  const scene = [];
  for (const n of Array.isArray(all) ? all : []) {
    const type = num(safeGet(n, "nodeType", -1), -1);
    if (type < 0 || type > 7) continue;
    const start = readPoint(n, "getGlobalStart");
    const end = readPoint(n, "getGlobalEnd");
    if (!start || !end) continue;
    const effTh = Math.abs(num(
      safeCall(n, "getEffectiveThickness", [], safeGet(n, "thickness", 1)), 1));
    const gradientMode = num(safeGet(n, "gradientMode", 0), 0);
    scene.push({
      node: n, type,
      drawIndex: num(safeGet(n, "drawIndex", scene.length), scene.length),
      sx: start[0]*figScale, sy: start[1]*figScale,
      ex: end[0]*figScale,   ey: end[1]*figScale,
      thickness: effTh * figScale,
      color: getNodeColor(n),
      gradientColor: hexToRgba(readHex(n, "gradientColorHex", readHex(n, "colorHex", "#000000"))),
      useGradient: bool(safeGet(n, "useGradient", false)),
      reverseGradient: bool(safeGet(n, "reverseGradient", false)),
      gradientMode,
      gradientAxis: gradientMode === 1 ? "y" : "x",
      hollow: bool(safeGet(n, "circleIsHollow", false)),
      trapStart: num(safeGet(n, "trapezoidThicknessStart", 0), 0),
      trapEnd: num(safeGet(n, "trapezoidThicknessEnd", 0), 0),
      numPoly: Math.max(3, Math.floor(num(safeGet(n, "numPolygonVertices", 5), 5))),
      curveRadius: num(safeGet(n, "segmentCurveRadiusAndDefaultCurveRadius",
        safeGet(n, "curveRadius", 0)), 0),
      isLimb: LIMB_TYPES.has(type),
      isStretchy: bool(safeGet(n, "isStretchy", false)),
      useSegmentScale: bool(safeGet(n, "useSegmentScale", false)),
      segmentScale: num(safeGet(n, "scale", 1), 1),
      triangleFlipped: bool(safeGet(n, "triangleFlipped", false)),
      triangleUpsideDown: bool(safeGet(n, "triangleUpsideDown", false)),
    });
  }
  scene.sort((a, b) => a.drawIndex - b.drawIndex);

  const polyfills = [];
  if (showFills) {
    const pfs = safeCall(fig, "allPolyfills", [], []);
    for (const pf of Array.isArray(pfs) ? pfs : []) {
      const anchor = num(safeGet(pf, "anchorDrawIndex", -1), -1);
      if (anchor < 0) continue;
      const flat = safeCall(fig, "getPolyfillVertices", [anchor], null);
      if (!flat || flat.length < 6) continue;
      const verts = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        verts.push({ x: num(flat[i])*figScale, y: num(flat[i+1])*figScale });
      }
      polyfills.push({
        anchor,
        verts,
        color: hexToRgba(readHex(pf, "colorHex", "#000000")),
        useColor: bool(safeGet(pf, "usePolyfillColor", false)),
      });
    }
  }
  return { scene, polyfills, figScale };
}

/* ── polyfill render ───────────────────────────────────────────── */
function drawPolyfill(ctx, pf, figColor) {
  const verts = pf.verts;
  if (!verts || verts.length < 3) return;
  const col = pf.useColor ? pf.color : figColor;
  const c = css(col), dim = css(mulColor(col, 0.1));
  for (let lv = 1; lv <= 3; lv++) {
    const o = 0.14 * lv;
    const offs = [[-o,-o],[-o,0],[-o,o],[0,-o],[0,o],[o,-o],[o,0],[o,o]];
    ctx.fillStyle = dim;
    for (const [dx, dy] of offs) {
      ctx.beginPath();
      ctx.moveTo(verts[0].x+dx, verts[0].y+dy);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x+dx, verts[i].y+dy);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.closePath(); ctx.fill();
}

/* ══════════════════════════════════════════════════════════════════════
   JSON EXPORT — outputs our format:
   { version, build, scale, color, nodes: [nested children], polyfills }
   ══════════════════════════════════════════════════════════════════════ */

function nodeToJsonObj(n) {
  const j = {};
  try { j.id = n.drawIndex; } catch (_) {}

  try {
    const t = n.nodeType;
    if (t >= 0 && t <= 7) j.type = TYPE_INT_TO_NAME[t];
  } catch (_) {}

  try { const v = n.length;    if (v) j.length = v; } catch (_) {}
  try { const v = n.thickness; if (v) j.thickness = v; } catch (_) {}
  try { const v = n.localAngle; if (v) j.angle = v; } catch (_) {}

  const boolMap = [
    ["static", "isStatic"], ["stretchy", "isStretchy"], ["floaty", "isFloaty"],
    ["smartStretch", "isSmartStretch"],
    ["doNotApplySmartStretch", "doNotApplySmartStretch"],
    ["smartStretchResetImpulse", "smartStretchResetImpulse"],
    ["useSegmentColor", "useSegmentColor"],
    ["useCircleOutline", "useCircleOutline"],
    ["hollow", "circleIsHollow"],
    ["useGradient", "useGradient"],
    ["reverseGradient", "reverseGradient"],
    ["useSegmentScale", "useSegmentScale"],
    ["curveCirculization", "curveCirculization"],
    ["halfArc", "halfArc"],
    ["triangleFlipped", "triangleFlipped"],
    ["triangleUpsideDown", "triangleUpsideDown"],
    ["trapezoidRoundedStart", "trapezoidIsRoundedStart"],
    ["trapezoidRoundedEnd", "trapezoidIsRoundedEnd"],
    ["dragLocked", "isDragLocked"],
  ];
  for (const [jk, wk] of boolMap) {
    try { if (n[wk]) j[jk] = true; } catch (_) {}
  }

  const numMap = [
    ["defaultLength", "defaultLength", 0],
    ["defaultThickness", "defaultThickness", 0],
    ["scale", "scale", 1],
    ["defaultAngle", "defaultAngle", 0],
    ["defaultLocalAngle", "defaultLocalAngle", 0],
    ["curveRadius", "segmentCurveRadiusAndDefaultCurveRadius", 0],
    ["curvePrecision", "segmentCurvePolyfillPrecision", 0],
    ["trapezoidStartThickness", "trapezoidThicknessStart", 0],
    ["trapezoidEndThickness", "trapezoidThicknessEnd", 0],
    ["polygonVertices", "numPolygonVertices", 0],
    ["angleLockRelativeMultiplier", "angleLockRelativeMultiplier", 0],
    ["dragLockAngle", "dragLockAngle", 0],
    ["smartStretchMultiplier", "smartStretchMultiplier", 1],
  ];
  for (const [jk, wk, def] of numMap) {
    try {
      const v = n[wk];
      if (v !== undefined && v !== null && v !== def) j[jk] = v;
    } catch (_) {}
  }

  try {
    const gm = n.gradientMode;
    if (gm === 1) j.gradientMode = "Normal";
  } catch (_) {}
  try {
    const tt = n.triangleType;
    if (tt === 1) j.triangleType = "RightTriangle";
  } catch (_) {}
  try {
    const al = n.angleLockMode;
    if (al === 1) j.angleLock = "Absolute";
    else if (al === 2) j.angleLock = "Relative";
  } catch (_) {}

  try { if (n.useSegmentColor && n.colorHex) j.color = n.colorHex; } catch (_) {}
  try { if (n.useGradient && n.gradientColorHex) j.gradientColor = n.gradientColorHex; } catch (_) {}
  try { if (n.useCircleOutline && n.circleOutlineHex) j.outlineColor = n.circleOutlineHex; } catch (_) {}
  try { if (n.useCircleOutline && n.circleOutlineColorHex) j.outlineColor = n.circleOutlineColorHex; } catch (_) {}

  return j;
}

export function figureToJSON(fig) {
  if (!fig) throw new Error("figureToJSON: figure required");
  const all = safeCall(fig, "allNodes", [], []);
  const byId = new Map();
  const childMap = new Map();
  for (const n of Array.isArray(all) ? all : []) {
    let idx = -1, parent = -1;
    try { idx = n.drawIndex; } catch (_) { continue; }
    try {
      const p = n.getParentIndex();
      if (p !== undefined && p !== null) parent = p;
    } catch (_) {}
    byId.set(idx, n);
    if (parent >= 0) {
      if (!childMap.has(parent)) childMap.set(parent, []);
      childMap.get(parent).push(idx);
    }
  }
  const build = (idx) => {
    const j = nodeToJsonObj(byId.get(idx));
    const kids = childMap.get(idx) || [];
    if (kids.length) j.children = kids.map(build);
    return j;
  };
  const topLevel = childMap.get(0) || [];
  const nodes = topLevel.map(build);

  const polyfills = [];
  const pfs = safeCall(fig, "allPolyfills", [], []);
  for (const pf of Array.isArray(pfs) ? pfs : []) {
    polyfills.push({
      anchor: num(safeGet(pf, "anchorDrawIndex", -1), -1),
      color: readHex(pf, "colorHex", "#000000"),
      useColor: bool(safeGet(pf, "usePolyfillColor", false)),
      attached: Array.from(safeGet(pf, "attached", []) || []),
    });
  }

  return {
    version: num(safeCall(fig, "version", [], safeGet(fig, "version", 425)), 425),
    build:   num(safeCall(fig, "build",   [], safeGet(fig, "build", 100)), 100),
    scale:   num(safeGet(fig, "scale", 1), 1),
    color:   readHex(fig, "colorHex", "#202020FF"),
    nodes,
    polyfills,
  };
}

export function jsonStringifyFigure(fig, pretty = true) {
  return JSON.stringify(figureToJSON(fig), null, pretty ? 2 : 0);
}

/* ══════════════════════════════════════════════════════════════════════
   JSON IMPORT — reads our format, builds a live WASM Stickfigure
   ══════════════════════════════════════════════════════════════════════ */

function jsonNodeToOptions(j) {
  const o = {};

  if (j.type !== undefined) {
    o.nodeType = typeof j.type === "string" ? j.type : TYPE_INT_TO_NAME[j.type];
  }

  const numMap = {
    length: "length", defaultLength: "defaultLength",
    thickness: "thickness", defaultThickness: "defaultThickness",
    scale: "scale", angle: "localAngle",
    defaultAngle: "defaultAngle", defaultLocalAngle: "defaultLocalAngle",
    curveRadius: "segmentCurveRadiusAndDefaultCurveRadius",
    curvePrecision: "segmentCurvePolyfillPrecision",
    trapezoidStartThickness: "trapezoidThicknessStart",
    trapezoidEndThickness: "trapezoidThicknessEnd",
    polygonVertices: "numPolygonVertices",
    angleLockRelativeMultiplier: "angleLockRelativeMultiplier",
    dragLockAngle: "dragLockAngle",
    smartStretchMultiplier: "smartStretchMultiplier",
  };
  for (const [jk, wk] of Object.entries(numMap)) {
    if (j[jk] !== undefined) o[wk] = Number(j[jk]);
  }

  const boolMap = {
    static: "isStatic", stretchy: "isStretchy", floaty: "isFloaty",
    smartStretch: "isSmartStretch",
    doNotApplySmartStretch: "doNotApplySmartStretch",
    smartStretchResetImpulse: "smartStretchResetImpulse",
    useSegmentColor: "useSegmentColor",
    useCircleOutline: "useCircleOutline",
    hollow: "circleIsHollow",
    useGradient: "useGradient",
    reverseGradient: "reverseGradient",
    useSegmentScale: "useSegmentScale",
    curveCirculization: "curveCirculization",
    halfArc: "halfArc",
    triangleFlipped: "triangleFlipped",
    triangleUpsideDown: "triangleUpsideDown",
    trapezoidRoundedStart: "trapezoidIsRoundedStart",
    trapezoidRoundedEnd: "trapezoidIsRoundedEnd",
    useTrapezoidStart: "useTrapezoidThicknessStart",
    useTrapezoidEnd: "useTrapezoidThicknessEnd",
    dragLocked: "isDragLocked",
  };
  for (const [jk, wk] of Object.entries(boolMap)) {
    if (j[jk] !== undefined) o[wk] = !!j[jk];
  }

  if (j.gradientMode !== undefined) o.gradientMode = j.gradientMode;
  if (j.triangleType !== undefined) o.triangleType = j.triangleType;
  if (j.angleLock !== undefined)    o.angleLockMode = j.angleLock;

  if (j.color !== undefined)         o.color = hexToWasmColor(j.color);
  if (j.gradientColor !== undefined) o.gradientColor = hexToWasmColor(j.gradientColor);
  if (j.outlineColor !== undefined)  o.circleOutlineColor = hexToWasmColor(j.outlineColor);

  return o;
}

export function jsonToFigure(json, StickfigureClass) {
  if (!json || typeof json !== "object")
    throw new Error("jsonToFigure: invalid JSON document");
  if (!StickfigureClass)
    throw new Error("jsonToFigure: pass the Stickfigure class as 2nd arg");

  const fig = new StickfigureClass();
  try { fig.setNodeLimitEnabled(false); } catch (_) {}

  if (json.version !== undefined) try { fig.setVersion(num(json.version, 425)); } catch (_) {}
  if (json.build !== undefined)   try { fig.build   = num(json.build, 100); } catch (_) {}
  if (json.scale !== undefined)   try { fig.scale   = num(json.scale, 1); } catch (_) {}
  if (json.color !== undefined)   try { fig.colorHex = json.color; } catch (_) {}

  const idToIndex = new Map();
  const root = fig.rootNode();

  const buildNode = (parent, nodeJSON) => {
    const options = jsonNodeToOptions(nodeJSON);
    let child;
    try {
      child = parent.addChild(options);
    } catch (e) {
      console.error("addChild failed for", nodeJSON, e);
      throw new Error(`Failed to add node of type ${nodeJSON.type}: ${e.message || e}`);
    }
    let idx = null;
    try { idx = child.drawIndex; } catch (_) {}
    if (nodeJSON.id !== undefined && idx !== null) {
      idToIndex.set(nodeJSON.id, idx);
    }
    if (Array.isArray(nodeJSON.children)) {
      for (const c of nodeJSON.children) buildNode(child, c);
    }
  };

  for (const n of (json.nodes || [])) buildNode(root, n);

  const resolve = (ref) => {
    if (typeof ref === "number") return ref;
    if (idToIndex.has(ref)) return idToIndex.get(ref);
    const n = Number(ref);
    return Number.isFinite(n) ? n : -1;
  };

  for (const pf of (json.polyfills || [])) {
    const anchor = resolve(pf.anchor);
    if (anchor < 0) continue;
    const attached = Array.isArray(pf.attached)
      ? pf.attached.map(resolve).filter(i => i >= 0) : [];
    try {
      fig.addPolyfill({
        anchor,
        colorHex: pf.color || "#000000FF",
        useColor: pf.useColor !== false,
        attached,
      });
    } catch (e) {
      console.warn("addPolyfill failed:", e, pf);
    }
  }

  return fig;
}

/* ══════════════════════════════════════════════════════════════════════
   Renderer class
   ══════════════════════════════════════════════════════════════════════ */

export class StickNodesRenderer {
  constructor(canvas) {
    if (!canvas) throw new Error("StickNodesRenderer: canvas required");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    if (!this.ctx) throw new Error("Canvas 2D unavailable");

    this.fig = null;
    this.showFills = true;
    this.showPoints = true;
    this.showLimbPointsOnly = true;
    this.flipY = false;
    this.dragEnabled = true;

    this.view = { cx: 0, cy: 0, zoom: 1, fitted: false };
    this.sceneCache = null;
    this._onNodeChanged = null;
    this._onSelect = null;

    this.pointers = new Map();
    this.activeDrag = null;
    this.activePan = null;
    this.pinch = null;
    this.lastTap = 0;
    this.selectedIndex = null;

    this._down  = this._down.bind(this);
    this._move  = this._move.bind(this);
    this._up    = this._up.bind(this);
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
  setFills(v)              { this.showFills = !!v; this.sceneCache = null; }
  setShowPoints(v)         { this.showPoints = !!v; }
  setShowLimbPointsOnly(v) { this.showLimbPointsOnly = !!v; }
  setFlipY(v)              { this.flipY = !!v; }
  setDragEnabled(v)        { this.dragEnabled = !!v; }
  setSelectedNode(idx)     { this.selectedIndex = idx; }
  onNodeChanged(fn)        { this._onNodeChanged = typeof fn === "function" ? fn : null; }
  onSelect(fn)             { this._onSelect = typeof fn === "function" ? fn : null; }
  getSelectedIndex()       { return this.selectedIndex; }
  invalidate()             { this.sceneCache = null; }
  getJSON()                { return this.fig ? figureToJSON(this.fig) : null; }

  _ensureSize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth  || this.canvas.clientWidth  || 640);
    const h = Math.max(1, parent?.clientHeight || this.canvas.clientHeight || 480);
    const tw = Math.floor(w * dpr), th = Math.floor(h * dpr);
    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width = tw;
      this.canvas.height = th;
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.view.fitted = false;
    }
  }

  _getScene() {
    if (!this.sceneCache && this.fig)
      this.sceneCache = extractScene(this.fig, this.showFills);
    return this.sceneCache;
  }

  fitView() {
    if (!this.fig) return;
    const cache = this._getScene();
    if (!cache) return;
    const { scene, polyfills } = cache;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const inc = (x, y, p = 0) => {
      minX = Math.min(minX, x - p); minY = Math.min(minY, y - p);
      maxX = Math.max(maxX, x + p); maxY = Math.max(maxY, y + p);
    };
    for (const s of scene) {
      const pad = Math.max(Math.abs(s.thickness), 4) / 2;
      inc(s.sx, s.sy, pad); inc(s.ex, s.ey, pad);
    }
    for (const pf of polyfills) for (const v of pf.verts) inc(v.x, v.y, 2);
    if (!isFinite(minX)) { minX = minY = -50; maxX = maxY = 50; }
    const pad = 10;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const spanX = Math.max(maxX - minX, 40), spanY = Math.max(maxY - minY, 40);
    const W = this.canvas.width, H = this.canvas.height;
    this.view.zoom = Math.max(0.001, Math.min(W*0.9/spanX, H*0.9/spanY));
    this.view.cx = (minX + maxX) / 2;
    this.view.cy = (minY + maxY) / 2;
    this.view.fitted = true;
  }
  resetView() { this.view.cx = 0; this.view.cy = 0; this.view.zoom = 1; this.view.fitted = true; }

  zoomBy(factor, pivotX, pivotY) {
    if (!this.view.zoom) this.view.zoom = 1;
    const W = this.canvas.width, H = this.canvas.height;
    if (pivotX === undefined) { pivotX = W/2; pivotY = H/2; }
    const wx = (pivotX - W/2) / this.view.zoom + this.view.cx;
    const wy = (pivotY - H/2) / this.view.zoom + this.view.cy;
    this.view.zoom = clamp(this.view.zoom * num(factor, 1), 0.001, 1000);
    this.view.cx = wx - (pivotX - W/2) / this.view.zoom;
    this.view.cy = wy - (pivotY - H/2) / this.view.zoom;
  }

  render() {
    if (!this.fig) return null;
    this._ensureSize();
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!this.view.fitted) this.fitView();
    const cache = this._getScene();
    if (!cache) return null;
    const { scene, polyfills } = cache;
    const zoom = this.view.zoom || 1;

    ctx.save();
    ctx.translate(W/2, H/2);
    if (this.flipY) ctx.scale(zoom, -zoom);
    else            ctx.scale(zoom, zoom);
    ctx.translate(-this.view.cx, -this.view.cy);

    for (const s of scene) drawNode(ctx, s);

    let figColor = hexToRgba(readHex(this.fig, "colorHex", "#202020FF"));
    for (const pf of polyfills) drawPolyfill(ctx, pf, figColor);

    if (this.showPoints) {
      const r = 7 / zoom, rw = 1.6 / zoom;
      const sel = this.selectedIndex;
      for (const s of scene) {
        if (this.showLimbPointsOnly && !s.isLimb) continue;
        ctx.beginPath(); ctx.arc(s.ex, s.ey, r, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
        ctx.beginPath(); ctx.arc(s.ex, s.ey, Math.max(0.5, r - rw), 0, Math.PI*2);
        ctx.fillStyle = s.drawIndex === sel ? "#4f46e5" : css(s.color); ctx.fill();
        if (s.drawIndex === sel) {
          ctx.beginPath(); ctx.arc(s.ex, s.ey, r + 2.5/zoom, 0, Math.PI*2);
          ctx.strokeStyle = "#4f46e5"; ctx.lineWidth = 2 / zoom; ctx.stroke();
        }
      }
    }

    ctx.restore();

    return {
      zoom,
      nodeCount: scene.length,
      limbNodeCount: scene.filter(s => s.isLimb).length,
      fillCount: polyfills.length,
    };
  }

  /* screen → world — flip-aware, correct */
  _screenToWorld(px, py) {
    const W = this.canvas.width, H = this.canvas.height;
    const rawX = (px - W/2) / this.view.zoom;
    const rawY = (py - H/2) / this.view.zoom;
    return {
      x: rawX + this.view.cx,
      y: this.flipY ? -rawY + this.view.cy : rawY + this.view.cy,
    };
  }
  _eventPos(ev) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (this.canvas.width  / Math.max(r.width, 1)),
      y: (ev.clientY - r.top)  * (this.canvas.height / Math.max(r.height, 1)),
    };
  }

  _hitNode(px, py) {
    if (!this.fig) return null;
    const world = this._screenToWorld(px, py);
    const cache = this._getScene();
    if (!cache) return null;
    let best = null, bestDist = Infinity;
    for (const s of cache.scene) {
      if (this.showLimbPointsOnly && !s.isLimb) continue;
      const d = Math.hypot(world.x - s.ex, world.y - s.ey);
      const tol = Math.max(20 / Math.max(this.view.zoom, 0.001), Math.abs(s.thickness) * 0.75);
      if (d < tol && d < bestDist) { best = s.node; bestDist = d; }
    }
    return best;
  }

  _down(ev) {
    this._ensureSize();
    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });
    try { this.canvas.setPointerCapture(ev.pointerId); } catch (_) {}

    if (this.pointers.size === 1) {
      const hit = this._hitNode(p.x, p.y);
      if (this.dragEnabled && hit) {
        const start = safeCall(hit, "getGlobalStart", [], [0, 0]);
        const figScale = num(safeGet(this.fig, "scale", 1), 1);
        let parentAngle = 0;
        const pi = safeCall(hit, "getParentIndex", [], -1);
        if (pi >= 0) {
          const parent = safeCall(this.fig, "getNode", [pi], null);
          parentAngle = num(safeCall(parent, "getGlobalAngle", [], 0), 0);
        }
        this.activeDrag = {
          node: hit,
          pivot: [num(start[0]) * figScale, num(start[1]) * figScale],
          parentAngle,
          figScale,
          stretchy: bool(safeGet(hit, "isStretchy", false)),
        };
        this.selectedIndex = num(safeGet(hit, "drawIndex", null), null);
      } else {
        const now = Date.now();
        if (now - this.lastTap < 320) {
          this.lastTap = 0;
          this.fitView(); this.render();
          this.pointers.delete(ev.pointerId);
          return;
        }
        this.lastTap = now;
        this.activePan = { lastX: p.x, lastY: p.y };
      }
      ev.preventDefault();
    } else if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      this.pinch = {
        startDist: Math.max(Math.hypot(dx, dy), 0.001),
        startZoom: this.view.zoom,
        startCx: this.view.cx,
        startCy: this.view.cy,
      };
      this.activeDrag = null; this.activePan = null;
    }
  }

  _move(ev) {
    if (!this.pointers.has(ev.pointerId)) return;
    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });

    if (this.pointers.size === 2 && this.pinch) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const dist = Math.max(Math.hypot(dx, dy), 0.001);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const newZoom = clamp(this.pinch.startZoom * dist / this.pinch.startDist, 0.001, 1000);
      const W = this.canvas.width, H = this.canvas.height;
      const wx = (midX - W/2) / this.pinch.startZoom + this.pinch.startCx;
      const wy = (midY - H/2) / this.pinch.startZoom + this.pinch.startCy;
      this.view.zoom = newZoom;
      this.view.cx = wx - (midX - W/2) / newZoom;
      this.view.cy = wy - (midY - H/2) / newZoom;
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
      try {
        node.localAngle = globalAngleDeg - this.activeDrag.parentAngle;
        if (this.activeDrag.stretchy) {
          const segScale = bool(safeGet(node, "useSegmentScale", false))
            ? Math.max(EPS, num(safeGet(node, "scale", 1), 1)) : 1;
          node.length = Math.hypot(dx, dy) / this.activeDrag.figScale / segScale;
        }
      } catch (e) { console.warn("drag update failed:", e); return; }
      this.sceneCache = null;
      this.render();
      if (this._onNodeChanged) this._onNodeChanged(node);
      return;
    }

    if (this.activePan) {
      const flip = this.flipY ? -1 : 1;
      this.view.cx -= (p.x - this.activePan.lastX) / this.view.zoom;
      this.view.cy -= (p.y - this.activePan.lastY) / this.view.zoom * flip;
      this.activePan.lastX = p.x;
      this.activePan.lastY = p.y;
      this.render();
    }
  }

  _up(ev) {
    const had = this.pointers.has(ev.pointerId);
    this.pointers.delete(ev.pointerId);
    try { this.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
    if (had && !this.activeDrag && !this.activePan && this.pointers.size === 0) {
      const p = this._eventPos(ev);
      const hit = this._hitNode(p.x, p.y);
      this.selectedIndex = hit ? num(safeGet(hit, "drawIndex", null), null) : null;
      if (this._onSelect) this._onSelect(hit || null);
      this.render();
    }
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) { this.activeDrag = null; this.activePan = null; }
  }

  _wheel(ev) {
    ev.preventDefault();
    const p = this._eventPos(ev);
    this.zoomBy(ev.deltaY < 0 ? 1.15 : 1/1.15, p.x, p.y);
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

export default StickNodesRenderer;