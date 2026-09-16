/* ══════════════════════════════════════════════════════════════════════
   renderer.js
   Canvas port of StickNodes SNShapeRenderer + drawLimbAA.
   Coordinates: world units, Y DOWN. Colors: {r,g,b,a} 0-255.
   ══════════════════════════════════════════════════════════════════════ */

/* ───── helpers ───── */
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
function mulColor(c, m) {
  return { r: c.r * m, g: c.g * m, b: c.b * m, a: c.a * m };
}
function css(c) {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${(Math.min(1, c.a / 255)).toFixed(3)})`;
}
function aaParams(m) {
  return Math.max(2, Math.floor((m < 80 ? m / 80 : 1) * 6));
}

/* ───── primitives (no AA) ───── */
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
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
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

/* ───── AA wrappers ───── */
function aSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ca = len > 0.001 ? dx / len : 1;
  const sa = len > 0.001 ? dy / len : 0;
  const N = aaParams(Math.max(th, len));
  for (let i = 1; i <= N; i++) {
    const g = i * 0.18666667, h = g / 2;
    pSeg(ctx, x1 - ca * h, y1 - sa * h, x2 + ca * h, y2 + sa * h, th + g, dim);
  }
  pSeg(ctx, x1, y1, x2, y2, th, col);
}
function aRSeg(ctx, x1, y1, x2, y2, th, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const len = Math.hypot(x2 - x1, y2 - y1);
  const N = aaParams(Math.max(th, len));
  for (let i = 0; i <= N; i++) pRSeg(ctx, x1, y1, x2, y2, th + i * 0.14, dim);
  pRSeg(ctx, x1, y1, x2, y2, th, col);
}
function aCircle(ctx, cx, cy, r, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const g = r < 40 ? r / 40 : 1;
  const N = Math.max(2, Math.floor(g * 6));
  for (let i = 0; i <= N; i++) pCircle(ctx, cx, cy, r + i * 0.093333334, dim);
  pCircle(ctx, cx, cy, r, col);
}
function aRing(ctx, cx, cy, ro, ri, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const g = ro < 40 ? ro / 40 : 1;
  const N = Math.max(2, Math.floor(g * 6));
  for (let i = 0; i <= N; i++) pRing(ctx, cx, cy, ro + i * 0.093333334, ri + i * 0.093333334, dim);
  pRing(ctx, cx, cy, ro, ri, col);
}
function jitter(ctx, c, fn) {
  const dim = css(mulColor(c, 0.1));
  for (let lv = 1; lv <= 5; lv++)
    for (let jx = -1; jx <= 1; jx++)
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        fn(jx, jy, lv, dim);
      }
  fn(0, 0, 1, css(c));
}
function aTri(ctx, x1, y1, x2, y2, x3, y3, th, c) {
  const jb = 0.28 * Math.min(Math.abs(th) / 12, 1);
  jitter(ctx, c, (jx, jy, lv, col) => {
    const ox = jx * 0.5 * jb * lv, oy = jy * 0.5 * jb * lv;
    pTri(ctx, x1 + ox, y1 + oy, x2 + ox, y2 + oy, x3 + ox, y3 + oy, col);
  });
}
function aEllipse(ctx, cx, cy, rx, ry, ang, c) {
  const jb = 0.42 * Math.min(Math.max(rx, ry) / 128, 1);
  jitter(ctx, c, (jx, jy, lv, col) => {
    const ox = jx * 0.5 * jb * lv, oy = jy * 0.5 * jb * lv;
    pEllipse(ctx, cx + ox, cy + oy, rx, ry, ang, col);
  });
}
function aTrap(ctx, x1, y1, x2, y2, w1, w2, ang, c) {
  const jb = 0.42 * Math.min(Math.max(w1, w2) / 80, 1);
  jitter(ctx, c, (jx, jy, lv, col) => {
    const ox = jx * 0.5 * jb * lv, oy = jy * 0.5 * jb * lv;
    pTrap(ctx, x1 + ox, y1 + oy, x2 + ox, y2 + oy, w1, w2, ang, col);
  });
}
function aPoly(ctx, cx, cy, r, n, ang, c) {
  const col = css(c), dim = css(mulColor(c, 0.2));
  const g = r < 32 ? r / 32 : 1;
  const N = Math.max(2, Math.floor(g * 6));
  for (let i = 0; i <= N; i++) pPoly(ctx, cx, cy, r + i * 0.23333333, n, ang, dim);
  pPoly(ctx, cx, cy, r, n, ang, col);
}

/* ───── curve subdivision ───── */
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
  else { while (da > 0) da -= Math.PI * 2; }
  const n = Math.max(4, Math.min(32, Math.round(Math.abs(da) * 4)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a1 + da * t;
    pts.push([ccx + Ra * Math.cos(a), ccy + Ra * Math.sin(a)]);
  }
  return pts;
}
function aRSegCurved(ctx, sx, sy, ex, ey, th, R, c) {
  const pts = subdivideCurve(sx, sy, ex, ey, R);
  for (let i = 0; i < pts.length - 1; i++)
    aRSeg(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], th, c);
}

/* ───── polyfill ───── */
function aPolyfill(ctx, verts, c) {
  if (verts.length < 3) return;
  jitter(ctx, c, (jx, jy, lv, col) => {
    const ox = jx * 0.5 * 0.28 * lv, oy = jy * 0.5 * 0.28 * lv;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(verts[0].x + ox, verts[0].y + oy);
    for (let i = 1; i < verts.length; i++)
      ctx.lineTo(verts[i].x + ox, verts[i].y + oy);
    ctx.closePath();
    ctx.fill();
  });
}

/* ───── node dispatch ───── */
function drawNode(ctx, s) {
  const len = Math.hypot(s.ex - s.sx, s.ey - s.sy);
  const angle = Math.atan2(s.ey - s.sy, s.ex - s.sx);
  switch (s.type) {
    case 1:
      if (s.curveRadius) aRSegCurved(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color);
      else aSeg(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.color);
      break;
    case 0:
      if (s.curveRadius) aRSegCurved(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, s.color);
      else aRSeg(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.color);
      break;
    case 2: {
      const oR = (len + s.thickness) / 2;
      const iR = Math.max(0, oR - s.thickness);
      if (s.hollow) aRing(ctx, s.ex, s.ey, oR, iR, s.color);
      else aCircle(ctx, s.ex, s.ey, oR, s.color);
      break;
    }
    case 4:
      aCircle(ctx, s.ex, s.ey, Math.max(len, s.thickness) / 2, s.color);
      break;
    case 3: {
      const r = Math.max(1, len);
      const base = angle + Math.PI, side = 2 * Math.PI / 3;
      aTri(ctx,
        s.ex, s.ey,
        s.ex + r * Math.cos(base + side / 2), s.ey + r * Math.sin(base + side / 2),
        s.ex + r * Math.cos(base - side / 2), s.ey + r * Math.sin(base - side / 2),
        s.thickness, s.color);
      break;
    }
    case 5:
      aEllipse(ctx, s.ex, s.ey, Math.max(0.5, len / 2), Math.max(0.5, s.thickness / 2), angle, s.color);
      break;
    case 6: {
      const w1 = s.trapStart || s.thickness;
      const w2 = s.trapEnd || s.thickness * 0.5;
      aTrap(ctx, s.sx, s.sy, s.ex, s.ey, w1, w2, angle, s.color);
      break;
    }
    case 7:
      aPoly(ctx, s.ex, s.ey, Math.max(1, len), Math.max(3, s.numPoly), angle, s.color);
      break;
  }
}

/* ───── scene extraction ───── */
function extractScene(fig, showFills) {
  const figScale = fig.scale || 1;
  const nodes = fig.allNodes();
  const scene = [];
  for (const n of nodes) {
    let type;
    try { type = n.nodeType; } catch (_) { continue; }
    if (type === -1) continue;
    let start, end;
    try { start = n.getGlobalStart(); end = n.getGlobalEnd(); } catch (_) { continue; }
    let hollow = false, trapStart = 0, trapEnd = 0, numPoly = 5, curveRadius = 0;
    try { hollow = n.circleIsHollow; } catch (_) {}
    try { trapStart = n.getTrapezoidThicknessStart(); } catch (_) {}
    try { trapEnd = n.getTrapezoidThicknessEnd(); } catch (_) {}
    try { numPoly = n.numPolygonVertices; } catch (_) {}
    try { curveRadius = n.segmentCurveRadiusAndDefaultCurveRadius; } catch (_) {}
    scene.push({
      node: n, type: n.nodeType, drawIndex: n.drawIndex,
      sx: start[0] * figScale, sy: start[1] * figScale,
      ex: end[0] * figScale,   ey: end[1] * figScale,
      thickness: Math.abs(n.getEffectiveThickness() || 1) * figScale,
      color: hexToRgba(n.getDisplayColorHex()),
      hollow, trapStart, trapEnd, numPoly, curveRadius,
      useSegmentScale: (() => { try { return n.useSegmentScale; } catch (_) { return false; } })(),
      segScale: (() => { try { return n.scale || 1; } catch (_) { return 1; } })(),
    });
  }

  const polyfills = [];
  if (showFills) {
    try {
      const raw = fig.allPolyfills();
      for (const pf of raw) {
        try {
          const flat = fig.getPolyfillVertices(pf.anchorDrawIndex);
          const verts = [];
          for (let i = 0; i + 1 < flat.length; i += 2)
            verts.push({ x: flat[i] * figScale, y: flat[i + 1] * figScale });
          if (verts.length >= 3) polyfills.push({
            verts, color: hexToRgba(pf.colorHex), useColor: pf.usePolyfillColor,
          });
        } catch (_) {}
      }
    } catch (_) {}
  }
  return { scene, polyfills, figScale };
}

/* ══════════════════════════════════════════════════════════════════════
   StickNodesRenderer
   ══════════════════════════════════════════════════════════════════════ */
export class StickNodesRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fig = null;
    this.showFills = true;
    this.dragEnabled = true;
    this.view = { cx: 0, cy: 0, zoom: 0, fitted: false };
    this.sceneCache = null;

    this._onNodeChanged = null;
    this._onSelect = null;

    this.pointers = new Map();
    this.activeDrag = null;   // { node, pivot:[x,y], parentAngle }
    this.activePan = null;    // { lastX, lastY }
    this.pinch = null;        // { startDist, startZoom, worldPt }
    this.lastTap = 0;
    this.selectedIndex = null;

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up   = this._up.bind(this);
    this._wheel = this._wheel.bind(this);

    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointercancel', this._up);
    canvas.addEventListener('wheel', this._wheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  setFigure(fig) {
    this.fig = fig;
    this.view.fitted = false;
    this.sceneCache = null;
    this.selectedIndex = null;
  }
  setFills(v) { this.showFills = v; this.sceneCache = null; }
  setDragEnabled(v) { this.dragEnabled = v; }
  onNodeChanged(fn) { this._onNodeChanged = fn; }
  onSelect(fn) { this._onSelect = fn; }
  getSelectedIndex() { return this.selectedIndex; }

  _ensureSize() {
    const dpr = window.devicePixelRatio || 1;
    const wrap = this.canvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }
  }

  _getScene() {
    if (!this.sceneCache && this.fig) {
      this.sceneCache = extractScene(this.fig, this.showFills);
    }
    return this.sceneCache;
  }
  invalidate() { this.sceneCache = null; }

  fitView() {
    const { scene, polyfills } = this._getScene();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxPad = 0;
    for (const n of scene) {
      const pad = Math.max(n.thickness, Math.hypot(n.ex - n.sx, n.ey - n.sy)) / 2;
      if (pad > maxPad) maxPad = pad;
      for (const p of [[n.sx, n.sy], [n.ex, n.ey]]) {
        if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1];
      }
    }
    for (const pf of polyfills) for (const v of pf.verts) {
      if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
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
    const wx = (pivotX - W / 2) / this.view.zoom + this.view.cx;
    const wy = (pivotY - H / 2) / this.view.zoom + this.view.cy;
    this.view.zoom = Math.max(0.001, Math.min(1000, this.view.zoom * factor));
    this.view.cx = wx - (pivotX - W / 2) / this.view.zoom;
    this.view.cy = wy - (pivotY - H / 2) / this.view.zoom;
  }

  render() {
    if (!this.fig) return null;
    this._ensureSize();
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const { scene, polyfills } = this._getScene();
    if (!this.view.fitted) this.fitView();

    const zoom = this.view.zoom, cx = this.view.cx, cy = this.view.cy;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    for (const n of scene) drawNode(ctx, n);

    let figCol = { r: 32, g: 32, b: 32, a: 255 };
    try { figCol = hexToRgba(this.fig.colorHex); } catch (_) {}
    for (const pf of polyfills) {
      const c = pf.useColor ? pf.color : figCol;
      aPolyfill(ctx, pf.verts, c);
    }

    ctx.restore();

    return { zoom, nodeCount: scene.length, fillCount: polyfills.length };
  }

  /* ───── screen ↔ world ───── */
  _screenToWorld(px, py) {
    const W = this.canvas.width, H = this.canvas.height;
    return {
      x: (px - W / 2) / this.view.zoom + this.view.cx,
      y: (py - H / 2) / this.view.zoom + this.view.cy,
    };
  }
  _eventPos(ev) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (this.canvas.width / r.width),
      y: (ev.clientY - r.top)  * (this.canvas.height / r.height),
    };
  }

  /* ───── pointer events ───── */
  _down(ev) {
    this._ensureSize();
    const p = this._eventPos(ev);
    this.pointers.set(ev.pointerId, { x: p.x, y: p.y });
    this.canvas.setPointerCapture(ev.pointerId);

    if (this.pointers.size === 1) {
      // Try to hit a node tip for drag
      const hit = this._hitNode(p.x, p.y);
      if (this.dragEnabled && hit) {
        const figScale = this.fig.scale || 1;
        const start = hit.getGlobalStart();
        let parentAngle = 0;
        try {
          const pi = hit.getParentIndex();
          if (pi !== undefined && pi !== null && pi >= 0) {
            parentAngle = this.fig.getNode(pi).getGlobalAngle();
          }
        } catch (_) {}
        this.activeDrag = {
          node: hit,
          pivot: [start[0] * figScale, start[1] * figScale],
          parentAngle,
          figScale,
        };
      } else {
        // Check double-tap → fit
        const now = Date.now();
        if (now - this.lastTap < 320 && !this.pointers.has(-1)) {
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
      // Start pinch
      const pts = Array.from(this.pointers.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      this.pinch = {
        startDist: Math.hypot(dx, dy),
        startZoom: this.view.zoom,
        startCx: this.view.cx,
        startCy: this.view.cy,
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
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const factor = dist / this.pinch.startDist;
      const newZoom = Math.max(0.001, Math.min(1000, this.pinch.startZoom * factor));
      // Keep the world point under the pinch center fixed
      const W = this.canvas.width, H = this.canvas.height;
      const worldX = (midX - W / 2) / this.pinch.startZoom + this.pinch.startCx;
      const worldY = (midY - H / 2) / this.pinch.startZoom + this.pinch.startCy;
      this.view.zoom = newZoom;
      this.view.cx = worldX - (midX - W / 2) / newZoom;
      this.view.cy = worldY - (midY - H / 2) / newZoom;
      this.render();
      return;
    }

    if (this.activeDrag && this.fig) {
      const world = this._screenToWorld(p.x, p.y);
      const dx = world.x - this.activeDrag.pivot[0];
      const dy = world.y - this.activeDrag.pivot[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const globalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const node = this.activeDrag.node;
      const figScale = this.activeDrag.figScale;
      const segScale = node.useSegmentScale ? (node.scale || 1) : 1;
      try {
        node.localAngle = globalAngleDeg - this.activeDrag.parentAngle;
        node.length = len / figScale / segScale;
      } catch (_) { return; }
      this.sceneCache = null;
      this.render();
      if (this._onNodeChanged) this._onNodeChanged(node);
      return;
    }

    if (this.activePan) {
      const dx = p.x - this.activePan.lastX;
      const dy = p.y - this.activePan.lastY;
      this.view.cx -= dx / this.view.zoom;
      this.view.cy -= dy / this.view.zoom;
      this.activePan.lastX = p.x;
      this.activePan.lastY = p.y;
      this.render();
    }
  }

  _up(ev) {
    const had = this.pointers.has(ev.pointerId);
    this.pointers.delete(ev.pointerId);
    try { this.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

    // Was this a clean tap (no drag / no pan) on a node?
    if (had && !this.activeDrag && !this.activePan && this.pointers.size === 0) {
      const p = this._eventPos(ev);
      const hit = this._hitNode(p.x, p.y);
      if (hit) {
        this.selectedIndex = hit.drawIndex;
        if (this._onSelect) this._onSelect(hit);
        this.render();
      } else {
        this.selectedIndex = null;
        if (this._onSelect) this._onSelect(null);
        this.render();
      }
    }

    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) { this.activeDrag = null; this.activePan = null; }
  }

  _wheel(ev) {
    ev.preventDefault();
    const p = this._eventPos(ev);
    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomBy(factor, p.x, p.y);
    this.render();
  }

  _hitNode(px, py) {
    if (!this.fig) return null;
    const world = this._screenToWorld(px, py);
    const figScale = this.fig.scale || 1;
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
    this.canvas.removeEventListener('pointerdown', this._down);
    this.canvas.removeEventListener('pointermove', this._move);
    this.canvas.removeEventListener('pointerup', this._up);
    this.canvas.removeEventListener('pointercancel', this._up);
    this.canvas.removeEventListener('wheel', this._wheel);
  }
}
