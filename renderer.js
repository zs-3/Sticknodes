/* ══════════════════════════════════════════════════════════════════════
   renderer.js  —  Canvas port of SNShapeRenderer + drawLimbAA
   Matches StickNodes Java source exactly.
   Coordinates: world units, Y DOWN. Colors: {r,g,b,a} 0-255.
   ══════════════════════════════════════════════════════════════════════ */

/* ─── Color helpers ─── */
function hexToRgba(hex) {
  let h = String(hex).replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('') + 'FF';
  else if (h.length === 4) h = h.split('').map(c => c + c).join('');
  else if (h.length === 6) h += 'FF';
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  };
}

// Matches Java Color.mul(m) — multiplies ALL 4 channels (r,g,b,a)
// For AA passes the source colors are always full alpha so this is correct
function mulColor(c, m) {
  return { r: c.r * m, g: c.g * m, b: c.b * m, a: c.a * m };
}

function css(c) {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${Math.min(1, c.a / 255).toFixed(3)})`;
}

// aaParams: matches Java Math.max(2, (int)(scale * 6))
// where scale = maxDim < 80 ? maxDim/80 : 1
function aaParams(maxDim) {
  return Math.max(2, Math.floor((maxDim < 80 ? maxDim / 80 : 1) * 6));
}

/* ─── Primitives (no AA) ─── */

function pSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function pRSeg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function pCircle(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(r, 0.01), 0, Math.PI * 2); ctx.fill();
}

function pRing(ctx, cx, cy, ro, ri, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(ro, 0.01), 0, Math.PI * 2, false);
  ctx.arc(cx, cy, Math.max(ri, 0.01), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
}

function pEllipse(ctx, cx, cy, rx, ry, ang, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (ctx.ellipse) {
    ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), ang, 0, Math.PI * 2);
  } else {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    const s = Math.max(rx, ry);
    ctx.scale(rx / s, ry / s);
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.restore();
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
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else          ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}

function pTrap(ctx, x1, y1, x2, y2, w1, w2, ang, col) {
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.lineTo(x2 - nx * w2 / 2, y2 - ny * w2 / 2);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.closePath(); ctx.fill();
}

/* ─── AA wrappers — exact port of drawLimbAA ─── */

// RoundedSegment AA — matches Java type 0 branch:
//   grow += 0.14 per pass, passes = max(2, floor(scale*6))
//   where scale = max(th, len*assetScaling) < 80 ? .../80 : 1
//   Note: assetScaling in Java is typically 1.0 for preview, so we use 1.0
function aRSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.2));
  const len = Math.hypot(x2 - x1, y2 - y1);
  const N = aaParams(Math.max(th, len));
  let grow = 0;
  for (let i = 0; i <= N; i++) {
    grow += 0.14;
    pRSeg(ctx, x1, y1, x2, y2, th + grow, dim);
  }
  pRSeg(ctx, x1, y1, x2, y2, th, col);
}

// Segment AA — matches Java type 1 branch:
//   grow += 0.18666667 per pass
//   endpoints also extend by grow*0.5 in segment direction
function aSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.2));
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ca = len > 0.001 ? (x2 - x1) / len : 1;
  const sa = len > 0.001 ? (y2 - y1) / len : 0;
  const N = aaParams(Math.max(th, len));
  let grow = 0;
  for (let i = 0; i <= N; i++) {
    grow += 0.18666667;
    const h = grow * 0.5; // endpoint extension
    pSeg(ctx,
      x1 - ca * h, y1 - sa * h,
      x2 + ca * h, y2 + sa * h,
      th + grow, dim);
  }
  pSeg(ctx, x1, y1, x2, y2, th, col);
}

// Circle AA — matches Java circle branch: grow += 0.093333334
function aCircle(ctx, cx, cy, r, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.2));
  const N = aaParams(r);
  let grow = 0;
  for (let i = 0; i <= N; i++) {
    grow += 0.093333334;
    pCircle(ctx, cx, cy, r + grow, dim);
  }
  pCircle(ctx, cx, cy, r, col);
}

// Ring (hollow circle) AA
function aRing(ctx, cx, cy, ro, ri, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.2));
  const N = aaParams(ro);
  let grow = 0;
  for (let i = 0; i <= N; i++) {
    grow += 0.093333334;
    pRing(ctx, cx, cy, ro + grow, ri + grow, dim);
  }
  pRing(ctx, cx, cy, ro, ri, col);
}

// Ellipse AA — jitter pattern matching Java (0.42 base, 5 levels)
function aEllipse(ctx, cx, cy, rx, ry, ang, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.1));
  const jb = 0.42 * Math.min(Math.max(rx, ry) / 128, 1);
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        const ox = jx * 0.5 * jb * lv;
        const oy = jy * 0.5 * jb * lv;
        pEllipse(ctx, cx + ox, cy + oy, rx, ry, ang, dim);
      }
    }
  }
  pEllipse(ctx, cx, cy, rx, ry, ang, col);
}

// Triangle AA — jitter (0.28 base, 5 levels, mul 0.1)
function aTri(ctx, x1, y1, x2, y2, x3, y3, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.1));
  const jb = 0.28;
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        const ox = jx * 0.5 * jb * lv;
        const oy = jy * 0.5 * jb * lv;
        pTri(ctx, x1+ox, y1+oy, x2+ox, y2+oy, x3+ox, y3+oy, dim);
      }
    }
  }
  pTri(ctx, x1, y1, x2, y2, x3, y3, col);
}

// Trapezoid AA — jitter
function aTrap(ctx, x1, y1, x2, y2, w1, w2, ang, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.1));
  const jb = 0.42 * Math.min(Math.max(w1, w2) / 80, 1);
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        const ox = jx * 0.5 * jb * lv;
        const oy = jy * 0.5 * jb * lv;
        pTrap(ctx, x1+ox, y1+oy, x2+ox, y2+oy, w1, w2, ang, dim);
      }
    }
  }
  pTrap(ctx, x1, y1, x2, y2, w1, w2, ang, col);
}

// Polygon AA
function aPoly(ctx, cx, cy, r, n, ang, c) {
  const col = css(c);
  const dim = css(mulColor(c, 0.2));
  const N = aaParams(r);
  let grow = 0;
  for (let i = 0; i <= N; i++) {
    grow += 0.23333333;
    pPoly(ctx, cx, cy, r + grow, n, ang, dim);
  }
  pPoly(ctx, cx, cy, r, n, ang, col);
}

/* ─── Polyfill AA — exact port of drawPolyfillAA ───
   getPolyfillVertices returns flat Float32Array already triangulated by
   the WASM's EarClippingTriangulator.
   Layout: [x0,y0, x1,y1, x2,y2,  x3,y3, x4,y4, x5,y5, ...]
           └────── triangle 0 ──────┘  └────── triangle 1 ──────┘
   Each triangle gets the full jitter AA treatment independently.
   Java: f4 = 0.28 (fixed), mul(0.1f), 5 levels × 8 directions.
─── */
function drawPolyfillTrianglesAA(ctx, flatVerts, figScale, c) {
  if (!flatVerts || flatVerts.length < 6) return;
  const col = css(c);
  const dim = css(mulColor(c, 0.1));
  const JB = 0.28; // fixed constant from Java, NOT scaled by anything

  const triCount = Math.floor(flatVerts.length / 6);
  for (let t = 0; t < triCount; t++) {
    const base = t * 6;
    const ax = flatVerts[base + 0] * figScale;
    const ay = flatVerts[base + 1] * figScale;
    const bx = flatVerts[base + 2] * figScale;
    const by = flatVerts[base + 3] * figScale;
    const cx = flatVerts[base + 4] * figScale;
    const cy = flatVerts[base + 5] * figScale;

    // 5 levels × 8 surrounding directions (skip center) — mul(0.1)
    for (let lv = 1; lv <= 5; lv++) {
      for (let jx = -1; jx <= 1; jx++) {
        for (let jy = -1; jy <= 1; jy++) {
          if (jx === 0 && jy === 0) continue;
          const ox = jx * 0.5 * JB * lv; // = jx * 0.14 * lv
          const oy = jy * 0.5 * JB * lv;
          pTri(ctx, ax+ox, ay+oy, bx+ox, by+oy, cx+ox, cy+oy, dim);
        }
      }
    }
    // Final full-color pass — no offset
    pTri(ctx, ax, ay, bx, by, cx, cy, col);
  }
}

/* ─── Curve subdivision ─── */
function subdivideCurve(ax, ay, bx, by, R) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  if (len < 0.5 || Math.abs(R) < 0.5) return [[ax, ay], [bx, by]];
  const half = len / 2, Ra = Math.abs(R);
  if (Ra < half) return [[ax, ay], [bx, by]];
  const h = Ra - Math.sqrt(Ra * Ra - half * half);
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const px = -dy / len, py = dx / len;
  const sign = R > 0 ? 1 : -1;
  const ccx = mx + px * h * sign, ccy = my + py * h * sign;
  const a1 = Math.atan2(ay - ccy, ax - ccx);
  const a2 = Math.atan2(by - ccy, bx - ccx);
  let da = a2 - a1;
  if (sign > 0) { while (da < 0) da += Math.PI * 2; }
  else          { while (da > 0) da -= Math.PI * 2; }
  const n = Math.max(4, Math.min(32, Math.round(Math.abs(da) * 4)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a1 + da * (i / n);
    pts.push([ccx + Ra * Math.cos(a), ccy + Ra * Math.sin(a)]);
  }
  return pts;
}

function aRSegCurved(ctx, sx, sy, ex, ey, th, R, c) {
  const pts = subdivideCurve(sx, sy, ex, ey, R);
  for (let i = 0; i < pts.length - 1; i++)
    aRSeg(ctx, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], th, c);
}

function aSegCurved(ctx, sx, sy, ex, ey, th, R, c) {
  const pts = subdivideCurve(sx, sy, ex, ey, R);
  for (let i = 0; i < pts.length - 1; i++)
    aSeg(ctx, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], th, c);
}

/* ─── Node dispatch — mirrors drawLimbAA switch ─── */
function drawNode(ctx, s) {
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  switch (s.type) {
    // 0 = RoundedSegment
    case 0:
      if (s.curveRadius)
        aRSegCurved(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color);
      else
        aRSeg(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.color);
      break;

    // 1 = Segment
    case 1:
      if (s.curveRadius)
        aSegCurved(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color);
      else
        aSeg(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.color);
      break;

    // 2 = Circle
    case 2: {
      // In Java: outer = (length + thickness) * scale * assetScaling * 0.5
      //          inner = thickness * scale * assetScaling * 0.5
      // We have already applied figScale in extractScene, so:
      const innerR = s.thickness / 2;
      const outerR = (len + s.thickness) / 2; // (length+thickness)/2
      if (s.hollow)
        aRing(ctx, s.ex, s.ey, outerR, innerR, s.color);
      else
        aCircle(ctx, s.ex, s.ey, outerR, s.color);
      break;
    }

    // 4 = FilledCircle
    case 4: {
      // radius = max(length, thickness) / 2
      const r = Math.max(len, s.thickness) / 2;
      aCircle(ctx, s.ex, s.ey, r, s.color);
      break;
    }

    // 3 = Triangle
    // In Java: tip at end, base at start, triangle drawn with cosAngle/sinAngle
    case 3: {
      // tip = end point, base spread from start point perpendicular
      const halfBase = Math.max(1, s.thickness) / 2;
      const px = -dy / (len || 1), py = dx / (len || 1); // perpendicular
      aTri(ctx,
        s.ex, s.ey,                              // tip
        s.sx + px * halfBase, s.sy + py * halfBase, // base left
        s.sx - px * halfBase, s.sy - py * halfBase, // base right
        s.color);
      break;
    }

    // 5 = Ellipse
    case 5: {
      // rx = length/2, ry = thickness/2, angle rotates with segment
      const rx = Math.max(0.5, len / 2);
      const ry = Math.max(0.5, s.thickness / 2);
      aEllipse(ctx, s.ex, s.ey, rx, ry, angle - Math.PI / 2, s.color);
      break;
    }

    // 6 = Trapezoid
    case 6: {
      const w1 = s.trapStart > 0 ? s.trapStart : s.thickness;
      const w2 = s.trapEnd   > 0 ? s.trapEnd   : s.thickness * 0.5;
      aTrap(ctx, s.sx, s.sy, s.ex, s.ey, w1, w2, angle, s.color);
      break;
    }

    // 7 = Polygon
    case 7: {
      const r = Math.max(1, len);
      aPoly(ctx, s.ex, s.ey, r, Math.max(3, s.numPoly), angle, s.color);
      break;
    }
  }
}

/* ─── Scene extraction ─── */
function extractScene(fig, showFills) {
  const figScale = fig.scale || 1;
  const nodes = fig.allNodes();
  const scene = [];

  for (const n of nodes) {
    let type;
    try { type = n.nodeType; } catch (_) { continue; }
    if (type === -1) continue; // root node

    let start, end;
    try { start = n.getGlobalStart(); end = n.getGlobalEnd(); } catch (_) { continue; }

    // Collect all extra properties with safe fallbacks
    let hollow = false, trapStart = 0, trapEnd = 0;
    let numPoly = 5, curveRadius = 0, stretchy = false;

    try { hollow     = !!n.circleIsHollow;                               } catch (_) {}
    try { trapStart  = n.trapezoidThicknessStart;                        } catch (_) {}  // getter
    try { trapEnd    = n.trapezoidThicknessEnd;                          } catch (_) {}  // getter
    try { numPoly    = n.numPolygonVertices;                             } catch (_) {}
    try { curveRadius = n.segmentCurveRadiusAndDefaultCurveRadius;       } catch (_) {}
    try { stretchy   = !!n.isStretchy;                                   } catch (_) {}

    scene.push({
      node:       n,
      type,
      drawIndex:  n.drawIndex,
      sx: start[0] * figScale,
      sy: start[1] * figScale,
      ex: end[0]   * figScale,
      ey: end[1]   * figScale,
      // getEffectiveThickness already accounts for useSegmentScale etc.
      thickness: Math.abs(n.getEffectiveThickness() || 1) * figScale,
      // getDisplayColorHex handles useSegmentColor flag internally
      color: hexToRgba(n.getDisplayColorHex()),
      hollow, trapStart, trapEnd, numPoly, curveRadius, stretchy,
    });
  }

  // Polyfills — raw flat vertices from WASM are ALREADY ear-clipped triangles
  const polyfills = [];
  if (showFills) {
    try {
      const raw = fig.allPolyfills();
      for (const pf of raw) {
        try {
          // getPolyfillVertices returns Float32Array of triangulated verts:
          // [x0,y0, x1,y1, x2,y2,  x3,y3, x4,y4, x5,y5, ...]
          // each group of 6 = one triangle (already ear-clipped by WASM)
          const flat = fig.getPolyfillVertices(pf.anchorDrawIndex);
          if (flat && flat.length >= 6) {
            polyfills.push({
              flat,       // raw triangulated Float32Array
              color: hexToRgba(pf.colorHex),
              useColor: pf.usePolyfillColor,
            });
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  return { scene, polyfills, figScale };
}

/* ══════════════════════════════════════════════════════════════════════
   StickNodesRenderer — public class
   ══════════════════════════════════════════════════════════════════════ */
export class StickNodesRenderer {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.fig     = null;
    this.showFills  = true;
    this.showPoints = true;
    this.flipY      = false;
    this.dragEnabled = true;
    this.view = { cx: 0, cy: 0, zoom: 0, fitted: false };
    this.sceneCache = null;

    this._onNodeChanged = null;
    this._onSelect      = null;

    this.pointers    = new Map();
    this.activeDrag  = null;
    this.activePan   = null;
    this.pinch       = null;
    this.lastTap     = 0;
    this.selectedIndex = null;

    this._down  = this._down.bind(this);
    this._move  = this._move.bind(this);
    this._up    = this._up.bind(this);
    this._wheel = this._wheel.bind(this);

    canvas.addEventListener('pointerdown',   this._down);
    canvas.addEventListener('pointermove',   this._move);
    canvas.addEventListener('pointerup',     this._up);
    canvas.addEventListener('pointercancel', this._up);
    canvas.addEventListener('wheel',         this._wheel, { passive: false });
    canvas.addEventListener('contextmenu',   e => e.preventDefault());
  }

  /* ── Public API ── */
  setFigure(fig) {
    this.fig = fig;
    this.view.fitted = false;
    this.sceneCache = null;
    this.selectedIndex = null;
  }
  setFills(v)       { this.showFills   = !!v; this.sceneCache = null; }
  setShowPoints(v)  { this.showPoints  = !!v; }
  setFlipY(v)       { this.flipY       = !!v; }
  setDragEnabled(v) { this.dragEnabled = !!v; }
  onNodeChanged(fn) { this._onNodeChanged = fn; }
  onSelect(fn)      { this._onSelect = fn; }
  getSelectedIndex(){ return this.selectedIndex; }
  invalidate()      { this.sceneCache = null; }

  /* ── Sizing ── */
  _ensureSize() {
    const dpr  = window.devicePixelRatio || 1;
    const wrap = this.canvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const tw = Math.floor(w * dpr), th = Math.floor(h * dpr);
    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width  = tw; this.canvas.height = th;
      this.canvas.style.width  = w + 'px';
      this.canvas.style.height = h + 'px';
    }
  }

  _getScene() {
    if (!this.sceneCache && this.fig)
      this.sceneCache = extractScene(this.fig, this.showFills);
    return this.sceneCache;
  }

  /* ── View ── */
  fitView() {
    const { scene, polyfills } = this._getScene();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxPad = 0;
    for (const n of scene) {
      const pad = Math.max(n.thickness, Math.hypot(n.ex - n.sx, n.ey - n.sy)) / 2;
      if (pad > maxPad) maxPad = pad;
      for (const [px, py] of [[n.sx, n.sy], [n.ex, n.ey]]) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
    }
    for (const pf of polyfills) {
      const f = pf.flat;
      for (let i = 0; i + 1 < f.length; i += 2) {
        const vx = f[i] * (this.fig ? this.fig.scale || 1 : 1);
        const vy = f[i+1] * (this.fig ? this.fig.scale || 1 : 1);
        if (vx < minX) minX = vx; if (vy < minY) minY = vy;
        if (vx > maxX) maxX = vx; if (vy > maxY) maxY = vy;
      }
    }
    if (!isFinite(minX)) { minX = minY = -50; maxX = maxY = 50; }
    const pad = maxPad + 8;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const spanX = Math.max(maxX - minX, 40), spanY = Math.max(maxY - minY, 40);
    const W = this.canvas.width, H = this.canvas.height;
    this.view.zoom = Math.min((W - 40) / spanX, (H - 40) / spanY);
    this.view.cx = (minX + maxX) / 2;
    this.view.cy = (minY + maxY) / 2;
    this.view.fitted = true;
  }

  resetView() {
    this.view.cx = 0; this.view.cy = 0; this.view.zoom = 1; this.view.fitted = true;
  }

  zoomBy(factor, pivotX, pivotY) {
    const W = this.canvas.width, H = this.canvas.height;
    if (pivotX === undefined) { pivotX = W / 2; pivotY = H / 2; }
    const wx = (pivotX - W/2) / this.view.zoom + this.view.cx;
    const wy = (pivotY - H/2) / this.view.zoom + this.view.cy;
    this.view.zoom = Math.max(0.001, Math.min(1000, this.view.zoom * factor));
    this.view.cx = wx - (pivotX - W/2) / this.view.zoom;
    this.view.cy = wy - (pivotY - H/2) / this.view.zoom;
  }

  /* ── Render ── */
  render() {
    if (!this.fig) return null;
    this._ensureSize();
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cache = this._getScene();
    if (!this.view.fitted) this.fitView();

    const { scene, polyfills, figScale } = cache;
    const zoom = this.view.zoom;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, this.flipY ? -zoom : zoom);
    ctx.translate(-this.view.cx, -this.view.cy);

    // Draw nodes (segments, circles, etc.)
    for (const n of scene) drawNode(ctx, n);

    // Draw polyfills — per-triangle AA matching drawPolyfillAA exactly
    let figCol = { r: 32, g: 32, b: 32, a: 255 };
    try { figCol = hexToRgba(this.fig.colorHex); } catch (_) {}

    for (const pf of polyfills) {
      const c = pf.useColor ? pf.color : figCol;
      drawPolyfillTrianglesAA(ctx, pf.flat, figScale, c);
    }

    // Node point overlays
    if (this.showPoints) {
      const rPx  = 7;
      const rW   = rPx / zoom;
      const ringW = 1.6 / zoom;
      const sel  = this.selectedIndex;
      for (const s of scene) {
        ctx.beginPath();
        ctx.arc(s.ex, s.ey, rW, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.ex, s.ey, Math.max(0.5, rW - ringW), 0, Math.PI * 2);
        ctx.fillStyle = s.drawIndex === sel ? '#4f46e5' : css(s.color);
        ctx.fill();

        if (s.drawIndex === sel) {
          ctx.beginPath();
          ctx.arc(s.ex, s.ey, rW + 2.5 / zoom, 0, Math.PI * 2);
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
    return { zoom, nodeCount: scene.length, fillCount: polyfills.length };
  }

  /* ── Coordinate conversion ── */
  _screenToWorld(px, py) {
    const W = this.canvas.width, H = this.canvas.height;
    return {
      x:  (px - W/2) / this.view.zoom + this.view.cx,
      y: ((py - H/2) / this.view.zoom + this.view.cy) * (this.flipY ? -1 : 1),
    };
  }
  _eventPos(ev) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (this.canvas.width  / r.width),
      y: (ev.clientY - r.top)  * (this.canvas.height / r.height),
    };
  }

  /* ── Pointer events ── */
  _down(ev) {
    this._ensureSize();
    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });
    this.canvas.setPointerCapture(ev.pointerId);

    if (this.pointers.size === 1) {
      const hit = this._hitNode(p.x, p.y);
      if (this.dragEnabled && hit) {
        const figScale = this.fig.scale || 1;
        const start = hit.getGlobalStart();
        let parentAngle = 0;
        try {
          const pi = hit.getParentIndex();
          if (pi !== undefined && pi !== null && pi >= 0)
            parentAngle = this.fig.getNode(pi).getGlobalAngle();
        } catch (_) {}
        let stretchy = true;
        try { stretchy = !!hit.isStretchy; } catch (_) {}
        this.activeDrag = { node: hit, pivot: [start[0]*figScale, start[1]*figScale], parentAngle, figScale, stretchy };
      } else {
        const now = Date.now();
        if (now - this.lastTap < 320) {
          this.lastTap = 0;
          this.fitView(); this.render();
          this.pointers.delete(ev.pointerId); return;
        }
        this.lastTap = now;
        this.activePan = { lastX: p.x, lastY: p.y };
      }
      ev.preventDefault();
    } else if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      this.pinch = { startDist: Math.hypot(dx, dy), startZoom: this.view.zoom, startCx: this.view.cx, startCy: this.view.cy };
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
      const dist = Math.hypot(dx, dy);
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      const newZoom = Math.max(0.001, Math.min(1000, this.pinch.startZoom * dist / this.pinch.startDist));
      const W = this.canvas.width, H = this.canvas.height;
      const wx = (midX - W/2) / this.pinch.startZoom + this.pinch.startCx;
      const wy = (midY - H/2) / this.pinch.startZoom + this.pinch.startCy;
      this.view.zoom = newZoom;
      this.view.cx = wx - (midX - W/2) / newZoom;
      this.view.cy = wy - (midY - H/2) / newZoom;
      this.render(); return;
    }

    if (this.activeDrag && this.fig) {
      const world = this._screenToWorld(p.x, p.y);
      const dx = world.x - this.activeDrag.pivot[0];
      const dy = world.y - this.activeDrag.pivot[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const node = this.activeDrag.node;
      const globalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const segScale = node.useSegmentScale ? (node.scale || 1) : 1;
      try {
        node.localAngle = globalAngleDeg - this.activeDrag.parentAngle;
        if (this.activeDrag.stretchy)
          node.length = len / this.activeDrag.figScale / segScale;
      } catch (_) { return; }
      this.sceneCache = null;
      this.render();
      if (this._onNodeChanged) this._onNodeChanged(node);
      return;
    }

    if (this.activePan) {
      const flip = this.flipY ? -1 : 1;
      this.view.cx -= (p.x - this.activePan.lastX) / this.view.zoom;
      this.view.cy -= ((p.y - this.activePan.lastY) / this.view.zoom) * flip;
      this.activePan.lastX = p.x; this.activePan.lastY = p.y;
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
      this.selectedIndex = hit ? hit.drawIndex : null;
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

  _hitNode(px, py) {
    if (!this.fig) return null;
    const world = this._screenToWorld(px, py);
    const { scene } = this._getScene();
    let best = null, bestDist = Infinity;
    for (const s of scene) {
      const d = Math.hypot(world.x - s.ex, world.y - s.ey);
      const tol = Math.max(20 / this.view.zoom, s.thickness * 0.75);
      if (d < tol && d < bestDist) { best = s.node; bestDist = d; }
    }
    return best;
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown',   this._down);
    this.canvas.removeEventListener('pointermove',   this._move);
    this.canvas.removeEventListener('pointerup',     this._up);
    this.canvas.removeEventListener('pointercancel', this._up);
    this.canvas.removeEventListener('wheel',         this._wheel);
  }
}
