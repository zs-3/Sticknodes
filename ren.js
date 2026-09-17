/* ══════════════════════════════════════════════════════════════════════
   ren.js — StickNodes Canvas 2D renderer + JSON document layer
   WASM is the source of truth for transforms, polyfills, serialization.
   This file provides JSON ↔ WASM ↔ Canvas.
   ══════════════════════════════════════════════════════════════════════ */

export const NODE_TYPE = Object.freeze({
  RoundedSegment: 0, Segment: 1, Circle: 2, Triangle: 3,
  FilledCircle: 4, Ellipse: 5, Trapezoid: 6, Polygon: 7,
  ROUNDED_SEGMENT: 0, SEGMENT: 1, CIRCLE: 2, TRIANGLE: 3,
  FILLED_CIRCLE: 4, ELLIPSE: 5, TRAPEZOID: 6, POLYGON: 7,
});

const TYPE_NAME_TO_INT = {
  RoundedSegment: 0, Segment: 1, Circle: 2, Triangle: 3,
  FilledCircle: 4, Ellipse: 5, Trapezoid: 6, Polygon: 7,
};
const TYPE_INT_TO_NAME = {
  0: 'RoundedSegment', 1: 'Segment', 2: 'Circle', 3: 'Triangle',
  4: 'FilledCircle', 5: 'Ellipse', 6: 'Trapezoid', 7: 'Polygon',
};
const LIMB_TYPES = new Set([0, 1]);
const EPS = 1e-7;

const GRADIENT_MODE_NAMES = { 0: 'Sideways', 1: 'Normal' };
const TRIANGLE_TYPE_NAMES = { 0: 'Isosceles', 1: 'RightTriangle' };
const ANGLE_LOCK_NAMES    = { 0: 'None', 1: 'Absolute', 2: 'Relative' };

/* ── helpers ─────────────────────────────────────────────────────── */
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function bool(v, d = false) {
  if (v === undefined || v === null) return d;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return d;
}
function finitePoint(p) {
  return p && typeof p.length === 'number' && p.length >= 2 &&
    Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

/* ── colors ──────────────────────────────────────────────────────── */
export function hexToRgba(hex) {
  let h = String(hex ?? '#000000').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c+c).join('') + 'FF';
  else if (/^[0-9a-fA-F]{4}$/.test(h)) h = h.split('').map(c => c+c).join('');
  else if (/^[0-9a-fA-F]{6}$/.test(h)) h += 'FF';
  else if (!/^[0-9a-fA-F]{8}$/.test(h)) h = '000000FF';
  return {
    r: parseInt(h.slice(0,2), 16), g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16), a: parseInt(h.slice(6,8), 16),
  };
}
function hexToWasmColor(hex) {
  const c = hexToRgba(hex);
  return { red: c.r, green: c.g, blue: c.b, alpha: c.a };
}
export function rgbaToHex(c) {
  const h = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2,'0').toUpperCase();
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${h(c.a)}`;
}
function mulColor(c, m) { return { r:c.r*m, g:c.g*m, b:c.b*m, a:c.a*m }; }
function css(c) {
  return `rgba(${c.r|0},${c.g|0},${c.b|0},${(Math.min(1, c.a/255)).toFixed(3)})`;
}
function aaParams(m) { return Math.max(2, Math.floor((m < 80 ? m/80 : 1) * 6)); }

/* ── primitives ──────────────────────────────────────────────────── */
function pSeg(ctx, x1,y1,x2,y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}
function pRSeg(ctx, x1,y1,x2,y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(Math.abs(th), 0.01);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}
function pCircle(ctx, cx,cy,r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx,cy, Math.max(Math.abs(r),0.01), 0, Math.PI*2); ctx.fill();
}
function pRing(ctx, cx,cy,ro,ri, col) {
  const outer = Math.max(Math.abs(ro), 0.01);
  const inner = Math.max(0, Math.min(outer - EPS, Math.abs(ri)));
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx,cy, outer, 0, Math.PI*2, false);
  if (inner > EPS) ctx.arc(cx,cy, inner, 0, Math.PI*2, true);
  ctx.fill('evenodd');
}
function pEllipse(ctx, cx,cy,rx,ry,ang, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(cx,cy, Math.max(Math.abs(rx),0.01), Math.max(Math.abs(ry),0.01), ang, 0, Math.PI*2);
  else {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
    ctx.scale(Math.max(Math.abs(rx),0.01), Math.max(Math.abs(ry),0.01));
    ctx.arc(0,0,1,0,Math.PI*2); ctx.restore();
  }
  ctx.fill();
}
function pTri(ctx, x1,y1,x2,y2,x3,y3, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3);
  ctx.closePath(); ctx.fill();
}
function pPoly(ctx, cx,cy,r,n,ang, col) {
  n = Math.max(3, Math.floor(num(n, 5))); r = Math.max(Math.abs(r), 0.01);
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + i * Math.PI*2 / n;
    const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
    i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fill();
}
function pTrap(ctx, x1,y1,x2,y2, w1,w2, col) {
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy) || 1;
  const nx = -dy/len, ny = dx/len;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 + nx*w1/2, y1 + ny*w1/2);
  ctx.lineTo(x2 + nx*w2/2, y2 + ny*w2/2);
  ctx.lineTo(x2 - nx*w2/2, y2 - ny*w2/2);
  ctx.lineTo(x1 - nx*w1/2, y1 - ny*w1/2);
  ctx.closePath(); ctx.fill();
}

/* ── AA wrappers ────────────────────────────────────────────────── */
function aRSeg(ctx, x1,y1,x2,y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const len = Math.hypot(x2-x1, y2-y1);
  const N = aaParams(Math.max(Math.abs(th), len));
  let g = 0;
  for (let i = 0; i < N; i++) { g += 0.14; pRSeg(ctx, x1,y1,x2,y2, th+g, dim); }
  pRSeg(ctx, x1,y1,x2,y2, th, col);
}
function aSeg(ctx, x1,y1,x2,y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy);
  const ca = len > EPS ? dx/len : 1, sa = len > EPS ? dy/len : 0;
  const N = aaParams(Math.max(Math.abs(th), len));
  let g = 0;
  for (let i = 0; i < N; i++) {
    g += 0.18666667; const h = g*0.5;
    pSeg(ctx, x1-ca*h, y1-sa*h, x2+ca*h, y2+sa*h, th+g, dim);
  }
  pSeg(ctx, x1,y1,x2,y2, th, col);
}
function aCircle(ctx, cx,cy,r, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(r)); let g = 0;
  for (let i = 0; i < N; i++) { g += 0.093333334; pCircle(ctx, cx,cy,r+g, dim); }
  pCircle(ctx, cx,cy,r, col);
}
function aRing(ctx, cx,cy,ro,ri, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(ro)); let g = 0;
  for (let i = 0; i < N; i++) { g += 0.093333334; pRing(ctx, cx,cy,ro+g,ri+g, dim); }
  pRing(ctx, cx,cy,ro,ri, col);
}
function jitter(ctx, c, fn) {
  const dim = css(mulColor(c, 0.1));
  for (let lv = 1; lv <= 5; lv++)
    for (let jx = -1; jx <= 1; jx++)
      for (let jy = -1; jy <= 1; jy++) {
        if (!jx && !jy) continue;
        fn(jx,jy,lv, dim);
      }
  fn(0,0,1, css(c));
}
function aTri(ctx, x1,y1,x2,y2,x3,y3, c) {
  const jb = 0.28;
  jitter(ctx, c, (jx,jy,lv,col) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    pTri(ctx, x1+ox,y1+oy, x2+ox,y2+oy, x3+ox,y3+oy, col);
  });
}
function aEllipse(ctx, cx,cy,rx,ry,ang, c) {
  const jb = 0.42 * Math.min(Math.max(Math.abs(rx), Math.abs(ry)) / 128, 1);
  jitter(ctx, c, (jx,jy,lv,col) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    pEllipse(ctx, cx+ox,cy+oy, rx,ry,ang, col);
  });
}
function aTrap(ctx, x1,y1,x2,y2,w1,w2, c) {
  const jb = 0.42 * Math.min(Math.max(Math.abs(w1), Math.abs(w2)) / 80, 1);
  jitter(ctx, c, (jx,jy,lv,col) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    pTrap(ctx, x1+ox,y1+oy, x2+ox,y2+oy, w1,w2, col);
  });
}
function aPoly(ctx, cx,cy,r,n,ang, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.abs(r)); let g = 0;
  for (let i = 0; i < N; i++) { g += 0.23333333; pPoly(ctx, cx,cy,r+g,n,ang, dim); }
  pPoly(ctx, cx,cy,r,n,ang, col);
}

/* ── curved segment ─────────────────────────────────────────────── */
function curveInfo(x1,y1,x2,y2, R_) {
  const dx = x2-x1, dy = y2-y1, chord = Math.hypot(dx,dy);
  const R = Math.abs(num(R_));
  if (chord < EPS || R < chord/2 + EPS) return null;
  const half = chord/2, sag = Math.sqrt(Math.max(0, R*R - half*half));
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  const nx = -dy/chord, ny = dx/chord;
  const sign = num(R_) >= 0 ? 1 : -1;
  const cx = mx + nx*sag*sign, cy = my + ny*sag*sign;
  let a1 = Math.atan2(y1-cy, x1-cx);
  let a2 = Math.atan2(y2-cy, x2-cx);
  let da = a2 - a1;
  if (sign > 0) { while (da < 0) da += Math.PI*2; if (da > Math.PI) da -= Math.PI*2; }
  else { while (da > 0) da -= Math.PI*2; if (da < -Math.PI) da += Math.PI*2; }
  return { cx, cy, R, a1, a2: a1+da, da };
}
function aCurvedSegment(ctx, x1,y1,x2,y2, th, R, c, rounded) {
  const info = curveInfo(x1,y1,x2,y2, R);
  if (!info) { rounded ? aRSeg(ctx,x1,y1,x2,y2,th,c) : aSeg(ctx,x1,y1,x2,y2,th,c); return; }
  const col = css(c), dim = css(mulColor(c, 0.2));
  const N = aaParams(Math.max(Math.abs(th), info.R * Math.abs(info.da)));
  const grow = rounded ? 0.14 : 0.18666667;
  for (let i = 1; i <= N; i++) {
    ctx.strokeStyle = dim;
    ctx.lineWidth = Math.max(th + grow*i, 0.01);
    ctx.lineCap = rounded ? 'round' : 'butt';
    ctx.beginPath();
    ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
    ctx.stroke();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = rounded ? 'round' : 'butt';
  ctx.beginPath();
  ctx.arc(info.cx, info.cy, info.R, info.a1, info.a2, info.da < 0);
  ctx.stroke();
}

/* ── node dispatch ──────────────────────────────────────────────── */
function drawNode(ctx, s) {
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const c = s.color;
  switch (s.type) {
    case 0: aCurvedSegment(ctx, s.sx,s.sy,s.ex,s.ey, s.thickness, s.curveRadius, c, true); break;
    case 1: aCurvedSegment(ctx, s.sx,s.sy,s.ex,s.ey, s.thickness, s.curveRadius, c, false); break;
    case 2: {
      const innerR = Math.max(0, Math.abs(s.thickness)/2);
      const outerR = Math.max(innerR, (Math.abs(len) + Math.abs(s.thickness))/2);
      s.hollow ? aRing(ctx,s.ex,s.ey,outerR,innerR,c) : aCircle(ctx,s.ex,s.ey,outerR,c);
      break;
    }
    case 3: {
      const hb = Math.max(Math.abs(s.thickness), 0.01) / 2;
      const ux = len > EPS ? dx/len : 1, uy = len > EPS ? dy/len : 0;
      const px = -uy, py = ux;
      let ax = s.sx + px*hb, ay = s.sy + py*hb;
      let bx = s.sx - px*hb, by = s.sy - py*hb;
      if (s.triangleFlipped) { [ax,bx]=[bx,ax]; [ay,by]=[by,ay]; }
      aTri(ctx, s.ex,s.ey, ax,ay, bx,by, c);
      break;
    }
    case 4: {
      const r = Math.max(Math.abs(len), Math.abs(s.thickness)) / 2;
      aCircle(ctx, s.ex, s.ey, r, c);
      break;
    }
    case 5: {
      const rx = Math.max(0.5, Math.abs(len)/2);
      const ry = Math.max(0.5, Math.abs(s.thickness)/2);
      aEllipse(ctx, s.ex, s.ey, rx, ry, angle - Math.PI/2, c);
      break;
    }
    case 6: {
      const w1 = s.trapStart > EPS ? Math.abs(s.trapStart) : Math.abs(s.thickness);
      const w2 = s.trapEnd > EPS ? Math.abs(s.trapEnd) : Math.abs(s.thickness)*0.5;
      aTrap(ctx, s.sx,s.sy,s.ex,s.ey, w1,w2, c);
      break;
    }
    case 7: {
      const r = Math.max(1, Math.abs(len));
      aPoly(ctx, s.ex,s.ey, r, s.numPoly, angle, c);
      break;
    }
  }
}

/* ── safe WASM property access ──────────────────────────────────── */
function safeGet(obj, name, d) {
  try { const v = obj?.[name]; return v === undefined || v === null ? d : v; }
  catch (_) { return d; }
}
function safeCall(obj, name, args = [], d) {
  try {
    if (typeof obj?.[name] !== 'function') return d;
    const v = obj[name](...args);
    return v === undefined || v === null ? d : v;
  } catch (_) { return d; }
}

/* ── scene extraction ───────────────────────────────────────────── */
function extractScene(fig, showFills) {
  const figScale = Math.max(EPS, num(safeGet(fig, 'scale', 1), 1));
  const all = safeCall(fig, 'allNodes', [], []);
  const scene = [];
  if (Array.isArray(all)) {
    for (const n of all) {
      let type;
      try { type = n.nodeType; } catch (_) { continue; }
      if (typeof type !== 'number' || type < 0 || type > 7) continue;
      const start = safeCall(n, 'getGlobalStart', [], null);
      const end = safeCall(n, 'getGlobalEnd', [], null);
      if (!finitePoint(start) || !finitePoint(end)) continue;
      const th = Math.abs(num(
        safeCall(n, 'getEffectiveThickness', [], safeGet(n, 'thickness', 1)), 1
      )) * figScale;
      let drawIndex = 0;
      try { drawIndex = n.drawIndex ?? scene.length; } catch (_) {}
      scene.push({
        node: n, type, drawIndex,
        sx: num(start[0])*figScale, sy: num(start[1])*figScale,
        ex: num(end[0])*figScale, ey: num(end[1])*figScale,
        thickness: th,
        color: hexToRgba(safeCall(n, 'getDisplayColorHex', [], '#000000')),
        hollow: bool(safeGet(n, 'circleIsHollow', false)),
        trapStart: num(safeGet(n, 'trapezoidThicknessStart', 0), 0),
        trapEnd: num(safeGet(n, 'trapezoidThicknessEnd', 0), 0),
        numPoly: Math.max(3, Math.floor(num(safeGet(n, 'numPolygonVertices', 5), 5))),
        curveRadius: num(safeGet(n, 'segmentCurveRadiusAndDefaultCurveRadius', 0), 0),
        triangleFlipped: bool(safeGet(n, 'triangleFlipped', false)),
        isLimb: LIMB_TYPES.has(type),
        isStretchy: bool(safeGet(n, 'isStretchy', false)),
        useSegmentScale: bool(safeGet(n, 'useSegmentScale', false)),
        segmentScale: num(safeGet(n, 'scale', 1), 1),
      });
    }
  }
  scene.sort((a,b) => a.drawIndex - b.drawIndex);

  const polyfills = [];
  if (showFills) {
    const pfs = safeCall(fig, 'allPolyfills', [], []);
    if (Array.isArray(pfs)) {
      for (const pf of pfs) {
        const anchor = num(safeGet(pf, 'anchorDrawIndex', -1), -1);
        if (anchor < 0) continue;
        const flat = safeCall(fig, 'getPolyfillVertices', [anchor], null);
        if (!flat || flat.length < 6) continue;
        const verts = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          verts.push({ x: num(flat[i])*figScale, y: num(flat[i+1])*figScale });
        }
        polyfills.push({
          anchor, verts,
          color: hexToRgba(safeGet(pf, 'colorHex', '#000000')),
          useColor: bool(safeGet(pf, 'usePolyfillColor', false)),
        });
      }
    }
  }
  return { scene, polyfills, figScale };
}

/* ── polyfill render ────────────────────────────────────────────── */
function drawPolyfill(ctx, pf, figColor) {
  const verts = pf.verts;
  if (!verts || verts.length < 3) return;
  const col = pf.useColor ? pf.color : figColor;
  const c = css(col), dim = css(mulColor(col, 0.1));
  for (let lv = 1; lv <= 3; lv++) {
    const o = 0.14 * lv;
    const offs = [[-o,-o],[-o,0],[-o,o],[0,-o],[0,o],[o,-o],[o,0],[o,o]];
    ctx.fillStyle = dim;
    for (const [dx,dy] of offs) {
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
   JSON ↔ WASM
   ══════════════════════════════════════════════════════════════════════ */

function nodeToJSON(node) {
  const j = {};
  try { j.id = node.drawIndex; } catch (_) {}
  try { j.type = TYPE_INT_TO_NAME[node.nodeType] ?? node.nodeType; } catch (_) {}
  try { j.length = node.length; } catch (_) {}
  try { j.thickness = node.thickness; } catch (_) {}
  try { j.angle = node.localAngle; } catch (_) {}

  const numFields = [
    ['defaultLength','defaultLength',0],
    ['defaultThickness','defaultThickness',0],
    ['scale','scale',0],
    ['defaultAngle','defaultAngle',0],
    ['defaultLocalAngle','defaultLocalAngle',0],
    ['segmentCurveRadiusAndDefaultCurveRadius','curveRadius',0],
    ['segmentCurvePolyfillPrecision','curvePrecision',0],
    ['trapezoidThicknessStart','trapezoidStartThickness',0],
    ['trapezoidThicknessEnd','trapezoidEndThickness',0],
    ['numPolygonVertices','polygonVertices',0],
    ['angleLockRelativeMultiplier','angleLockRelativeMultiplier',0],
    ['dragLockAngle','dragLockAngle',0],
    ['smartStretchMultiplier','smartStretchMultiplier',0],
  ];
  for (const [w, jk, def] of numFields) {
    try {
      const v = node[w];
      if (v !== undefined && v !== null && v !== def) j[jk] = v;
    } catch (_) {}
  }

  const boolFields = [
    ['isStatic','static'],['isStretchy','stretchy'],['isFloaty','floaty'],
    ['isSmartStretch','smartStretch'],
    ['doNotApplySmartStretch','doNotApplySmartStretch'],
    ['smartStretchResetImpulse','smartStretchResetImpulse'],
    ['useSegmentColor','useSegmentColor'],
    ['useCircleOutline','useCircleOutline'],
    ['circleIsHollow','hollow'],
    ['useGradient','useGradient'],
    ['reverseGradient','reverseGradient'],
    ['useSegmentScale','useSegmentScale'],
    ['curveCirculization','curveCirculization'],
    ['halfArc','halfArc'],
    ['triangleFlipped','triangleFlipped'],
    ['triangleUpsideDown','triangleUpsideDown'],
    ['trapezoidIsRoundedStart','trapezoidRoundedStart'],
    ['trapezoidIsRoundedEnd','trapezoidRoundedEnd'],
    ['isDragLocked','dragLocked'],
  ];
  for (const [w, jk] of boolFields) {
    try { if (node[w]) j[jk] = true; } catch (_) {}
  }

  try {
    const v = node.gradientMode;
    const n = GRADIENT_MODE_NAMES[v];
    if (n && n !== 'Normal') j.gradientMode = n;
  } catch (_) {}
  try {
    const v = node.triangleType;
    const n = TRIANGLE_TYPE_NAMES[v];
    if (n && n !== 'Isosceles') j.triangleType = n;
  } catch (_) {}
  try {
    const v = node.angleLockMode;
    const n = ANGLE_LOCK_NAMES[v];
    if (n && n !== 'None') j.angleLock = n;
  } catch (_) {}

  try { if (node.useSegmentColor && node.colorHex) j.color = node.colorHex; } catch (_) {}
  try { if (node.useGradient && node.gradientColorHex) j.gradientColor = node.gradientColorHex; } catch (_) {}
  try { if (node.useCircleOutline && node.circleOutlineColorHex) j.outlineColor = node.circleOutlineColorHex; } catch (_) {}

  return j;
}

export function figureToJSON(fig) {
  if (!fig) throw new Error('figureToJSON: figure required');
  const all = safeCall(fig, 'allNodes', [], []);
  const byIndex = new Map();
  const childMap = new Map();
  if (Array.isArray(all)) {
    for (const n of all) {
      let idx, parent;
      try { idx = n.drawIndex; } catch (_) { continue; }
      try {
        parent = n.getParentIndex();
        if (parent === undefined || parent === null) parent = -1;
      } catch (_) { parent = -1; }
      byIndex.set(idx, n);
      if (parent >= 0) {
        if (!childMap.has(parent)) childMap.set(parent, []);
        childMap.get(parent).push(idx);
      }
    }
  }
  const buildNode = (idx) => {
    const j = nodeToJSON(byIndex.get(idx));
    const kids = childMap.get(idx) || [];
    if (kids.length) j.children = kids.map(buildNode);
    return j;
  };
  const topLevel = childMap.get(0) || [];
  const nodesJSON = topLevel.map(buildNode);

  const polyfills = [];
  const pfs = safeCall(fig, 'allPolyfills', [], []);
  if (Array.isArray(pfs)) {
    for (const pf of pfs) {
      polyfills.push({
        anchor: pf.anchorDrawIndex,
        color: pf.colorHex,
        useColor: pf.usePolyfillColor,
        attached: Array.from(pf.attached || []),
      });
    }
  }

  return {
    version: safeCall(fig, 'version', [], safeGet(fig, 'version', 0)),
    build:   safeCall(fig, 'build', [], safeGet(fig, 'build', 0)),
    scale:   num(safeGet(fig, 'scale', 1), 1),
    color:   safeGet(fig, 'colorHex', '#202020FF'),
    nodes:   nodesJSON,
    polyfills,
  };
}

export function jsonStringifyFigure(fig, pretty = true) {
  return JSON.stringify(figureToJSON(fig), null, pretty ? 2 : 0);
}

/* ── JSON → options object (matches WASM camelCase) ─────────────── */
function jsonNodeToOptions(j) {
  const o = {};
  if (j.type !== undefined) {
    o.nodeType = typeof j.type === 'string' ? TYPE_NAME_TO_INT[j.type] : j.type;
  }
  const numMap = {
    length:'length', defaultLength:'defaultLength',
    thickness:'thickness', defaultThickness:'defaultThickness',
    scale:'scale', angle:'localAngle',
    defaultAngle:'defaultAngle', defaultLocalAngle:'defaultLocalAngle',
    curveRadius:'segmentCurveRadiusAndDefaultCurveRadius',
    curvePrecision:'segmentCurvePolyfillPrecision',
    trapezoidStartThickness:'trapezoidThicknessStart',
    trapezoidEndThickness:'trapezoidThicknessEnd',
    polygonVertices:'numPolygonVertices',
    angleLockRelativeMultiplier:'angleLockRelativeMultiplier',
    dragLockAngle:'dragLockAngle',
    smartStretchMultiplier:'smartStretchMultiplier',
  };
  for (const [jk, wk] of Object.entries(numMap)) {
    if (j[jk] !== undefined) o[wk] = Number(j[jk]);
  }
  const boolMap = {
    static:'isStatic', stretchy:'isStretchy', floaty:'isFloaty',
    smartStretch:'isSmartStretch',
    doNotApplySmartStretch:'doNotApplySmartStretch',
    smartStretchResetImpulse:'smartStretchResetImpulse',
    useSegmentColor:'useSegmentColor',
    useCircleOutline:'useCircleOutline',
    hollow:'circleIsHollow',
    useGradient:'useGradient',
    reverseGradient:'reverseGradient',
    useSegmentScale:'useSegmentScale',
    curveCirculization:'curveCirculization',
    halfArc:'halfArc',
    triangleFlipped:'triangleFlipped',
    triangleUpsideDown:'triangleUpsideDown',
    trapezoidRoundedStart:'trapezoidIsRoundedStart',
    trapezoidRoundedEnd:'trapezoidIsRoundedEnd',
    useTrapezoidStart:'useTrapezoidThicknessStart',
    useTrapezoidEnd:'useTrapezoidThicknessEnd',
    dragLocked:'isDragLocked',
  };
  for (const [jk, wk] of Object.entries(boolMap)) {
    if (j[jk] !== undefined) o[wk] = !!j[jk];
  }
  if (j.gradientMode !== undefined) {
    o.gradientMode = typeof j.gradientMode === 'number'
      ? GRADIENT_MODE_NAMES[j.gradientMode] : j.gradientMode;
  }
  if (j.triangleType !== undefined) {
    o.triangleType = typeof j.triangleType === 'number'
      ? TRIANGLE_TYPE_NAMES[j.triangleType] : j.triangleType;
  }
  if (j.angleLock !== undefined) {
    o.angleLockMode = typeof j.angleLock === 'number'
      ? ANGLE_LOCK_NAMES[j.angleLock] : j.angleLock;
  }
  if (j.color !== undefined)         o.color = hexToWasmColor(j.color);
  if (j.gradientColor !== undefined) o.gradientColor = hexToWasmColor(j.gradientColor);
  if (j.outlineColor !== undefined)  o.circleOutlineColor = hexToWasmColor(j.outlineColor);
  return o;
}

export function jsonToFigure(json, StickfigureClass) {
  if (!json || typeof json !== 'object')
    throw new Error('jsonToFigure: invalid JSON');
  if (!StickfigureClass)
    throw new Error('jsonToFigure: pass the Stickfigure class as 2nd arg');

  const fig = new StickfigureClass();
  try { fig.setNodeLimitEnabled(false); } catch (_) {}

  if (json.version !== undefined) try { fig.setVersion(num(json.version, 425)); } catch (_) {}
  if (json.build !== undefined)   try { fig.build = num(json.build, 100); } catch (_) {}
  if (json.scale !== undefined)   try { fig.scale = num(json.scale, 1); } catch (_) {}
  if (json.color !== undefined)   try { fig.colorHex = json.color; } catch (_) {}

  const idToIndex = new Map();
  const root = fig.rootNode();

  const buildNode = (parent, nodeJSON) => {
    const options = jsonNodeToOptions(nodeJSON);
    let child;
    try { child = parent.addChild(options); }
    catch (e) {
      console.error('addChild failed for', nodeJSON, e);
      return;
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
    if (typeof ref === 'number') return ref;
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
        colorHex: pf.color || '#000000FF',
        useColor: pf.useColor !== false,
        attached,
      });
    } catch (e) {
      console.warn('addPolyfill failed:', e, pf);
    }
  }

  return fig;
}

/* ══════════════════════════════════════════════════════════════════════
   Renderer class
   ══════════════════════════════════════════════════════════════════════ */
export class StickNodesRenderer {
  constructor(canvas) {
    if (!canvas) throw new Error('StickNodesRenderer: canvas required');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('Canvas 2D unavailable');

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

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointercancel', this._up);
    canvas.addEventListener('wheel', this._wheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
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
  onNodeChanged(fn)        { this._onNodeChanged = typeof fn === 'function' ? fn : null; }
  onSelect(fn)             { this._onSelect = typeof fn === 'function' ? fn : null; }
  getSelectedIndex()       { return this.selectedIndex; }
  invalidate()             { this.sceneCache = null; }

  _ensureSize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth  || this.canvas.clientWidth  || 640);
    const h = Math.max(1, parent?.clientHeight || this.canvas.clientHeight || 480);
    const tw = Math.floor(w * dpr), th = Math.floor(h * dpr);
    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width = tw;
      this.canvas.height = th;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
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
    const inc = (x,y,p=0) => {
      minX = Math.min(minX, x-p); minY = Math.min(minY, y-p);
      maxX = Math.max(maxX, x+p); maxY = Math.max(maxY, y+p);
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
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
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

    let figColor = hexToRgba(safeGet(this.fig, 'colorHex', '#202020FF'));
    for (const pf of polyfills) drawPolyfill(ctx, pf, figColor);

    if (this.showPoints) {
      const r = 7 / zoom, rw = 1.6 / zoom;
      const sel = this.selectedIndex;
      for (const s of scene) {
        if (this.showLimbPointsOnly && !s.isLimb) continue;
        ctx.beginPath(); ctx.arc(s.ex, s.ey, r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
        ctx.beginPath(); ctx.arc(s.ex, s.ey, Math.max(0.5, r - rw), 0, Math.PI*2);
        ctx.fillStyle = s.drawIndex === sel ? '#4f46e5' : css(s.color); ctx.fill();
        if (s.drawIndex === sel) {
          ctx.beginPath(); ctx.arc(s.ex, s.ey, r + 2.5/zoom, 0, Math.PI*2);
          ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2 / zoom; ctx.stroke();
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
        const start = safeCall(hit, 'getGlobalStart', [], [0,0]);
        const figScale = num(safeGet(this.fig, 'scale', 1), 1);
        let parentAngle = 0;
        const pi = safeCall(hit, 'getParentIndex', [], -1);
        if (pi >= 0) {
          const parent = safeCall(this.fig, 'getNode', [pi], null);
          parentAngle = num(safeCall(parent, 'getGlobalAngle', [], 0), 0);
        }
        this.activeDrag = {
          node: hit,
          pivot: [num(start[0]) * figScale, num(start[1]) * figScale],
          parentAngle,
          figScale,
        };
        this.selectedIndex = num(safeGet(hit, 'drawIndex', null), null);
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
        startDist: Math.max(Math.hypot(dx,dy), 0.001),
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
      const dist = Math.max(Math.hypot(dx,dy), 0.001);
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
      if (Math.hypot(dx,dy) < 0.01) return;
      const node = this.activeDrag.node;
      const globalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      try {
        node.localAngle = globalAngleDeg - this.activeDrag.parentAngle;
        const stretchy = bool(safeGet(node, 'isStretchy', false));
        if (stretchy) {
          const segScale = bool(safeGet(node, 'useSegmentScale', false))
            ? Math.max(EPS, num(safeGet(node, 'scale', 1), 1)) : 1;
          node.length = Math.hypot(dx, dy) / this.activeDrag.figScale / segScale;
        }
      } catch (e) { console.warn('drag update failed:', e); return; }
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
      this.selectedIndex = hit ? num(safeGet(hit, 'drawIndex', null), null) : null;
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
    this.canvas.removeEventListener('pointerdown', this._down);
    this.canvas.removeEventListener('pointermove', this._move);
    this.canvas.removeEventListener('pointerup', this._up);
    this.canvas.removeEventListener('pointercancel', this._up);
    this.canvas.removeEventListener('wheel', this._wheel);
    this.pointers.clear();
    this.fig = null;
    this.sceneCache = null;
  }
}

export default StickNodesRenderer;
