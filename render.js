// renderer.js — Canvas port of SNShapeRenderer + drawLimbAA + polyfill + curves
// Coordinates: world units. Y is DOWN.

/* ═════════════════════════════════════════════════════════════════
   Color helpers
   ═════════════════════════════════════════════════════════════════ */
function parseHex(s) {
  let h = String(s).replace(/^#/, '');
  if (h.length === 6) h += 'FF';
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16),
    a: parseInt(h.slice(6,8), 16),
  };
}
function css(c, mul = 1) {
  return `rgba(${c.r},${c.g},${c.b},${Math.min(1, (c.a/255) * mul).toFixed(3)})`;
}

function aaParams(maxDim) {
  const g = maxDim < 80 ? maxDim / 80 : 1;
  return Math.max(2, Math.floor(g * 6));
}

/* ═════════════════════════════════════════════════════════════════
   Core primitives (no AA)
   ═════════════════════════════════════════════════════════════════ */
function seg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function rseg(ctx, x1, y1, x2, y2, th, col) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(th, 0.01);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function circ(ctx, cx, cy, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.arc(cx, cy, Math.max(r, 0.01), 0, Math.PI*2); ctx.fill();
}
function ring(ctx, cx, cy, ro, ri, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.arc(cx, cy, Math.max(ro, 0.01), 0, Math.PI*2, false);
  ctx.arc(cx, cy, Math.max(ri, 0.01), 0, Math.PI*2, true);
  ctx.fill('evenodd');
}
function elli(ctx, cx, cy, rx, ry, ang, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), ang, 0, Math.PI*2);
  ctx.fill();
}
function tri(ctx, x1, y1, x2, y2, x3, y3, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath(); ctx.fill();
}
function poly(ctx, cx, cy, r, sides, ang, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = ang + (i/sides) * Math.PI * 2;
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}
function trap(ctx, x1, y1, x2, y2, w1, w2, ang, col) {
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 + nx*w1/2, y1 + ny*w1/2);
  ctx.lineTo(x2 + nx*w2/2, y2 + ny*w2/2);
  ctx.lineTo(x2 - nx*w2/2, y2 - ny*w2/2);
  ctx.lineTo(x1 - nx*w1/2, y1 - ny*w1/2);
  ctx.closePath(); ctx.fill();
}

/* ═════════════════════════════════════════════════════════════════
   Curve subdivision (matches StickNode.getCurveNodes formula)
   Returns array of points along the arc from (sx,sy) to (ex,ey).
   ═════════════════════════════════════════════════════════════════ */
function subdivideCurve(sx, sy, ex, ey, curveRadius) {
  const len = Math.hypot(ex - sx, ey - sy);
  if (curveRadius === 0 || len < 0.5) return [[sx, sy], [ex, ey]];

  const n = Math.max(2, Math.floor(Math.cbrt(Math.max(len * 0.5, Math.abs(curveRadius) * 0.5)) * 8));

  // Circle center: radius = curveRadius, perpendicular to the segment
  const r = Math.abs(curveRadius);
  const dx = ex - sx, dy = ey - sy;
  const ang = Math.atan2(dy, dx);
  const perp = curveRadius > 0 ? ang + Math.PI/2 : ang - Math.PI/2;
  const cx = sx + r * Math.cos(perp);
  const cy = sy + r * Math.sin(perp);

  const a1 = Math.atan2(sy - cy, sx - cx);
  const a2 = Math.atan2(ey - cy, ex - cx);
  let da = a2 - a1;
  // Shortest path
  if (da > Math.PI) da -= Math.PI*2;
  if (da < -Math.PI) da += Math.PI*2;

  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a1 + da * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/* ═════════════════════════════════════════════════════════════════
   AA wrappers
   ═════════════════════════════════════════════════════════════════ */
function rsegAA(ctx, x1, y1, x2, y2, th, col) {
  const len = Math.hypot(x2-x1, y2-y1);
  const passes = aaParams(Math.max(th, len));
  ctx.globalAlpha = 0.2;
  for (let i = 0; i <= passes; i++)
    rseg(ctx, x1, y1, x2, y2, th + i * 0.14, col);
  ctx.globalAlpha = 1;
  rseg(ctx, x1, y1, x2, y2, th, col);
}
function segAA(ctx, x1, y1, x2, y2, th, col) {
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy);
  const ca = len > 0.001 ? dx/len : 1, sa = len > 0.001 ? dy/len : 0;
  const passes = aaParams(Math.max(th, len));
  ctx.globalAlpha = 0.2;
  for (let i = 1; i <= passes; i++) {
    const g = i * 0.18666667, h = g / 2;
    seg(ctx, x1 - ca*h, y1 - sa*h, x2 + ca*h, y2 + sa*h, th + g, col);
  }
  ctx.globalAlpha = 1;
  seg(ctx, x1, y1, x2, y2, th, col);
}
function circAA(ctx, cx, cy, r, col) {
  const g = r < 40 ? r/40 : 1;
  const passes = Math.max(2, Math.floor(g * 6));
  ctx.globalAlpha = 0.2;
  for (let i = 0; i <= passes; i++) circ(ctx, cx, cy, r + i*0.093333334, col);
  ctx.globalAlpha = 1;
  circ(ctx, cx, cy, r, col);
}
function ringAA(ctx, cx, cy, ro, ri, col) {
  const g = ro < 40 ? ro/40 : 1;
  const passes = Math.max(2, Math.floor(g * 6));
  ctx.globalAlpha = 0.2;
  for (let i = 0; i <= passes; i++) ring(ctx, cx, cy, ro + i*0.093333334, ri + i*0.093333334, col);
  ctx.globalAlpha = 1;
  ring(ctx, cx, cy, ro, ri, col);
}
function jitter(ctx, col, fn) {
  ctx.fillStyle = col;
  for (let lv = 1; lv <= 5; lv++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        ctx.globalAlpha = 0.1;
        fn(jx, jy, lv);
      }
    }
  }
  ctx.globalAlpha = 1;
  fn(0, 0, 1);
}
function triAA(ctx, x1, y1, x2, y2, x3, y3, th, col) {
  const jb = 0.28 * Math.min(Math.abs(th) / 12, 1);
  jitter(ctx, col, (jx, jy, lv) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    tri(ctx, x1+ox, y1+oy, x2+ox, y2+oy, x3+ox, y3+oy, col);
  });
}
function elliAA(ctx, cx, cy, rx, ry, ang, col) {
  const jb = 0.42 * Math.min(Math.max(rx, ry) / 128, 1);
  jitter(ctx, col, (jx, jy, lv) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    elli(ctx, cx+ox, cy+oy, rx, ry, ang, col);
  });
}
function trapAA(ctx, x1, y1, x2, y2, w1, w2, ang, col) {
  const jb = 0.42 * Math.min(Math.max(w1, w2) / 80, 1);
  jitter(ctx, col, (jx, jy, lv) => {
    const ox = jx*0.5*jb*lv, oy = jy*0.5*jb*lv;
    trap(ctx, x1+ox, y1+oy, x2+ox, y2+oy, w1, w2, ang, col);
  });
}
function polyAA(ctx, cx, cy, r, sides, ang, col) {
  const g = r < 32 ? r/32 : 1;
  const passes = Math.max(2, Math.floor(g * 6));
  ctx.globalAlpha = 0.2;
  for (let i = 0; i <= passes; i++) poly(ctx, cx, cy, r + i*0.23333333, sides, ang, col);
  ctx.globalAlpha = 1;
  poly(ctx, cx, cy, r, sides, ang, col);
}

/* ═════════════════════════════════════════════════════════════════
   Curved segment — draw as chain of rounded segments along the arc
   ═════════════════════════════════════════════════════════════════ */
function rsegCurvedAA(ctx, sx, sy, ex, ey, th, curveRadius, col) {
  const pts = subdivideCurve(sx, sy, ex, ey, curveRadius);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1];
    // Split thickness and passes across sub-segments so overlaps
    // don't create bulges at joints.
    rsegAA(ctx, a[0], a[1], b[0], b[1], th, col);
  }
  // Fill joints so no seams appear
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], th/2, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ═════════════════════════════════════════════════════════════════
   Polyfill — 5×8 jitter + solid, per triangle
   We receive the polyfill vertices already in world coordinates.
   ═════════════════════════════════════════════════════════════════ */
function drawPolyfillAA(ctx, verts, col) {
  if (verts.length < 3) return;
  // Simple fan triangulation works for convex polys; for concave ones
  // we'd need ear-clip, but most polyfills are visually convex per triangle.
  // We jitter the whole polygon by drawing it multiple times.
  jitter(ctx, col, (jx, jy, lv) => {
    const jb = 0.28;
    const ox = jx * 0.5 * jb * lv;
    const oy = jy * 0.5 * jb * lv;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(verts[0].x + ox, verts[0].y + oy);
    for (let i = 1; i < verts.length; i++)
      ctx.lineTo(verts[i].x + ox, verts[i].y + oy);
    ctx.closePath();
    ctx.fill();
  });
}

/* ═════════════════════════════════════════════════════════════════
   Node dispatch
   ═════════════════════════════════════════════════════════════════ */
function drawNodeAA(ctx, s) {
  const len = Math.hypot(s.ex - s.sx, s.ey - s.sy);
  const angle = Math.atan2(s.ey - s.sy, s.ex - s.sx);

  switch (s.type) {
    case 1: // Segment
      if (s.curveRadius !== 0) rsegCurvedAA(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, css(s.color));
      else segAA(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, css(s.color));
      break;

    case 0: // RoundedSegment
      if (s.curveRadius !== 0) rsegCurvedAA(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, s.curveRadius, css(s.color));
      else rsegAA(ctx, s.sx, s.sy, s.ex, s.ey, s.thickness, css(s.color));
      break;

    case 2: { // Circle
      const oR = (len + s.thickness) / 2;
      const iR = Math.max(0, oR - s.thickness);
      if (s.hollow) ringAA(ctx, s.ex, s.ey, oR, iR, css(s.color));
      else circAA(ctx, s.ex, s.ey, oR, css(s.color));
      break;
    }

    case 4: // FilledCircle
      circAA(ctx, s.ex, s.ey, Math.max(len, s.thickness)/2, css(s.color));
      break;

    case 3: { // Triangle
      const r = Math.max(1, len);
      const base = angle + Math.PI, side = 2*Math.PI/3;
      triAA(ctx,
        s.ex, s.ey,
        s.ex + r*Math.cos(base + side/2), s.ey + r*Math.sin(base + side/2),
        s.ex + r*Math.cos(base - side/2), s.ey + r*Math.sin(base - side/2),
        s.thickness, css(s.color));
      break;
    }

    case 5: // Ellipse
      elliAA(ctx, s.ex, s.ey, Math.max(0.5, len/2), Math.max(0.5, s.thickness/2), angle, css(s.color));
      break;

    case 6: { // Trapezoid
      const w1 = s.trapezoidThicknessStart || s.thickness;
      const w2 = s.trapezoidThicknessEnd   || s.thickness * 0.5;
      trapAA(ctx, s.sx, s.sy, s.ex, s.ey, w1, w2, angle, css(s.color));
      break;
    }

    case 7: // Polygon
      polyAA(ctx, s.ex, s.ey, Math.max(1, len), Math.max(3, s.numPolygonVertices), angle, css(s.color));
      break;
  }
}

/* ═════════════════════════════════════════════════════════════════
   Public API
   ═════════════════════════════════════════════════════════════════ */
export function renderFigure(canvas, fig) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const nodes = fig.allNodes();
  const scene = [];
  const endpointMap = new Map();   // drawIndex → world endpoint for polyfills

  for (const n of nodes) {
    const type = n.nodeType;
    if (type === -1) continue;

    let start, end;
    try { start = n.getGlobalStart(); end = n.getGlobalEnd(); }
    catch (e) { continue; }

    const th = Math.abs(n.getEffectiveThickness() || 1);
    const color = parseHex(n.getDisplayColorHex());
    let hollow = false, trS = 0, trE = 0, np = 5, cr = 0;
    try { hollow = n.circleIsHollow; } catch (_) {}
    try { trS = n.getTrapezoidThicknessStart(); } catch (_) {}
    try { trE = n.getTrapezoidThicknessEnd(); } catch (_) {}
    try { np = n.numPolygonVertices; } catch (_) {}
    try { cr = n.segmentCurveRadiusAndDefaultCurveRadius; } catch (_) {}

    const s = {
      type, sx: start[0], sy: start[1], ex: end[0], ey: end[1],
      thickness: th, color,
      hollow, trapezoidThicknessStart: trS, trapezoidThicknessEnd: trE,
      numPolygonVertices: np, curveRadius: cr,
    };
    scene.push(s);
    endpointMap.set(n.drawIndex, { x: end[0], y: end[1] });
  }

  // Polyfills
  const polyfills = [];
  let rawPfs = [];
  try { rawPfs = fig.allPolyfills(); } catch (_) {}
  for (const pf of rawPfs) {
    try {
      const flat = fig.getPolyfillVertices(pf.anchorDrawIndex);
      const verts = [];
      for (let i = 0; i + 1 < flat.length; i += 2)
        verts.push({ x: flat[i], y: flat[i+1] });
      polyfills.push({
        verts,
        color: parseHex(pf.colorHex),
        useColor: pf.usePolyfillColor,
      });
    } catch (_) {}
  }

  if (scene.length === 0) return;

  // BBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let maxPad = 0;
  for (const n of scene) {
    const pad = Math.max(n.thickness, Math.hypot(n.ex-n.sx, n.ey-n.sy)) / 2;
    if (pad > maxPad) maxPad = pad;
    for (const p of [[n.sx, n.sy], [n.ex, n.ey]]) {
      if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1];
    }
  }
  for (const pf of polyfills)
    for (const v of pf.verts) {
      if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
    }
  const pad = maxPad + 8;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const spanX = Math.max(maxX-minX, 40), spanY = Math.max(maxY-minY, 40);
  const fit = Math.min((W-40)/spanX, (H-40)/spanY);
  const cx = (minX+maxX)/2, cy = (minY+maxY)/2;

  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(fit, fit);
  ctx.translate(-cx, -cy);

  // Draw nodes first
  for (const s of scene) drawNodeAA(ctx, s);

  // Then polyfills on top
  let figColor = { r: 32, g: 32, b: 32, a: 255 };
  try { figColor = parseHex(fig.colorHex); } catch (_) {}
  for (const pf of polyfills) {
    const col = pf.useColor ? pf.color : figColor;
    drawPolyfillAA(ctx, pf.verts, css(col));
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  return fit;
}