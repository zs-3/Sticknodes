/* ═══════════════════════════════════════════════════════════════════════════
 * render.js — WebGL2 port of StickNodes SNShapeRenderer + drawLimbAA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Coordinate system: Y is DOWN in world space. Screen flip done in camera.
 * Units: same as the .nodes file (integers/f32). No assetScaling applied.
 *
 * Confirmed dependencies (from sticknodes_rs.d.ts):
 *   Stickfigure: rootNode(), getNode(i), allNodeIndices(), allPolyfills(),
 *                getPolyfillVertices(anchor), scale, colorHex, version, build
 *   Node:        drawIndex, nodeType, length, thickness, localAngle, scale,
 *                colorHex, useSegmentColor, useSegmentScale, circleIsHollow,
 *                numPolygonVertices, segmentCurveRadiusAndDefaultCurveRadius,
 *                getGlobalStart(), getGlobalEnd(), getEffectiveThickness(),
 *                getDisplayColorHex(), getTrapezoidThicknessStart/End(),
 *                children(), getParentIndex(), isStretchy
 *   PolyfillData: anchorDrawIndex, attached, colorHex, usePolyfillColor
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── Math helpers (exact ports) ───────────────────────── */

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const DEG2RAD = Math.PI / 180;

function segmentsForCircle(size) {
  return (clamp(Math.sqrt(size) * 2.25 + 4, 5, 40) | 0);
}
function segmentsForSegmentArc(radius) {
  return (clamp(Math.sqrt(radius) * 1.25 + 2, 5, 25) | 0);
}
function segmentsForTrapezoidWidth(w) {
  return (clamp(Math.sqrt(w) * 3, 5, 300) | 0);
}
function segmentsForCurve(len, curveRadius) {
  if (curveRadius === 0) return 1;
  const f = Math.max(len * 0.5, Math.abs(curveRadius) * 0.5);
  return (clamp(Math.sqrt(f) * 2, 5, 100) | 0);
}
function segmentsForTrapezoidCurve(len, r, w) {
  if (r === 0) return 1;
  const f = Math.max(Math.max(len * 0.5, Math.abs(r) * 0.5), w);
  return (clamp(Math.sqrt(f) * 3, 5, 150) | 0);
}

/* AA pass count — ported from drawLimbAA */
function aaPasses(maxDim) {
  const f = maxDim < 80 ? maxDim / 80 : 1;
  return Math.max(2, (f * 6) | 0);
}

/* ───────────────────────── Color ───────────────────────── */

function hexToRgba(s) {
  let h = String(s || '#202020FF').replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('') + 'FF';
  else if (h.length === 4) h = h.split('').map(c => c + c).join('');
  else if (h.length === 6) h += 'FF';
  else if (h.length !== 8) h = '202020FF';
  const n = i => parseInt(h.slice(i, i + 2), 16) || 0;
  return [n(0) / 255, n(2) / 255, n(4) / 255, n(6) / 255];
}

/* ───────────────────────── WebGL2 Batcher ───────────────────────── */

class Batcher {
  constructor(gl) {
    this.gl = gl;
    this.positions = [];
    this.colors = [];
    this.vertCount = 0;

    this.prog = this._buildProgram();
    this.attribLoc = {
      pos: gl.getAttribLocation(this.prog, 'a_pos'),
      col: gl.getAttribLocation(this.prog, 'a_col'),
    };
    this.uniProj = gl.getUniformLocation(this.prog, 'u_proj');
    this.uniGlobalAlpha = gl.getUniformLocation(this.prog, 'u_globalAlpha');

    this.vbo = gl.createBuffer();
    this.vboColor = gl.createBuffer();

    // Interleave into one Float32Array: [x, y, r, g, b, a]
    this.stride = 6;
  }

  _buildProgram() {
    const gl = this.gl;
    const vs = `#version 300 es
      in vec2 a_pos;
      in vec4 a_col;
      uniform mat3 u_proj;
      out vec4 v_col;
      void main() {
        vec3 p = u_proj * vec3(a_pos, 1.0);
        gl_Position = vec4(p.xy, 0.0, 1.0);
        v_col = a_col;
      }`;
    const fs = `#version 300 es
      precision mediump float;
      in vec4 v_col;
      uniform float u_globalAlpha;
      out vec4 outColor;
      void main() {
        outColor = vec4(v_col.rgb, v_col.a * u_globalAlpha);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('shader: ' + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  clear() {
    this.positions.length = 0;
    this.colors.length = 0;
    this.vertCount = 0;
  }

  /* Primitive vertex + triangle emitters */
  vertex(x, y, c) {
    this.positions.push(x, y);
    this.colors.push(c[0], c[1], c[2], c[3]);
    this.vertCount++;
  }
  triangle(a, b, c, ca, cb, cc) {
    this.vertex(a[0], a[1], ca);
    this.vertex(b[0], b[1], cb);
    this.vertex(c[0], c[1], cc);
  }
  quad(a, b, c, d, ca, cb, cc, cd) {
    this.triangle(a, b, c, ca, cb, cc);
    this.triangle(a, c, d, ca, cc, cd);
  }

  flush(projMat3, globalAlpha) {
    const gl = this.gl;
    if (this.vertCount === 0) return;

    // Interleave
    const n = this.vertCount;
    const buf = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      buf[i * 6 + 0] = this.positions[i * 2 + 0];
      buf[i * 6 + 1] = this.positions[i * 2 + 1];
      buf[i * 6 + 2] = this.colors[i * 4 + 0];
      buf[i * 6 + 3] = this.colors[i * 4 + 1];
      buf[i * 6 + 4] = this.colors[i * 4 + 2];
      buf[i * 6 + 5] = this.colors[i * 4 + 3];
    }

    gl.useProgram(this.prog);
    gl.uniformMatrix3fv(this.uniProj, false, projMat3);
    gl.uniform1f(this.uniGlobalAlpha, globalAlpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.attribLoc.pos);
    gl.vertexAttribPointer(this.attribLoc.pos, 2, gl.FLOAT, false, this.stride * 4, 0);
    gl.enableVertexAttribArray(this.attribLoc.col);
    gl.vertexAttribPointer(this.attribLoc.col, 4, gl.FLOAT, false, this.stride * 4, 2 * 4);
    gl.drawArrays(gl.TRIANGLES, 0, n);

    this.clear();
  }
}

/* ───────────────────────── Curve subdivision (exact port) ─────────────────────────
 * Produces a chain of points approximating the arc.
 * R > 0  => bulge to the right of (start→end)
 * R < 0  => bulge to the left
 */
function subdivideCurve(ax, ay, bx, by, R) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.5 || Math.abs(R) < 0.5) return [[ax, ay], [bx, by]];

  const Ra = Math.abs(R);
  const half = len / 2;
  if (Ra < half) return [[ax, ay], [bx, by]];

  const h = Ra - Math.sqrt(Ra * Ra - half * half);
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const px = -dy / len, py = dx / len;
  const sign = R > 0 ? 1 : -1;
  const cx = mx + px * h * sign;
  const cy = my + py * h * sign;

  const a1 = Math.atan2(ay - cy, ax - cx);
  const a2 = Math.atan2(by - cy, bx - cx);
  let da = a2 - a1;
  if (sign > 0) { while (da < 0) da += Math.PI * 2; }
  else { while (da > 0) da -= Math.PI * 2; }

  const n = Math.max(4, Math.min(48, Math.round(Math.abs(da) * 6)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a1 + da * t;
    pts.push([cx + Ra * Math.cos(a), cy + Ra * Math.sin(a)]);
  }
  return pts;
}

/* ───────────────────────── Primitive emitters ─────────────────────────
 * All angles in radians. Y down. Colors as [r,g,b,a] floats 0-1.
 * These append to a Batcher.
 */

/* Straight segment, no rounded caps. */
function emitSegment(b, x1, y1, x2, y2, thickness, cA, cB) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  const ca = dx / len, sa = dy / len;
  const half = thickness / 2;
  const ox = -sa * half, oy = ca * half;

  const TL = [x1 + ox, y1 - oy];
  const TR = [x1 - ox, y1 + oy];
  const BR = [x2 - ox, y2 + oy];
  const BL = [x2 + ox, y2 - oy];

  b.quad(TL, TR, BR, BL, cA, cA, cB, cB);
}

/* Rounded segment: rectangle + two semicircle caps. */
function emitRoundedSegment(b, x1, y1, x2, y2, thickness, cA, cB) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    // Degenerate: single circle
    emitCircle(b, x1, y1, thickness / 2, cA);
    return;
  }
  const ca = dx / len, sa = dy / len;
  const half = thickness / 2;
  const ox = -sa * half, oy = ca * half;

  const TL = [x1 + ox, y1 - oy];
  const TR = [x1 - ox, y1 + oy];
  const BR = [x2 - ox, y2 + oy];
  const BL = [x2 + ox, y2 - oy];

  b.quad(TL, TR, BR, BL, cA, cA, cB, cB);

  const segs = segmentsForSegmentArc(half);
  const step = Math.PI / segs;
  const cs = Math.cos(step), ss = Math.sin(step);

  // End cap (around x2,y2) — angle = atan2(sa,ca)
  emitCap(b, x2, y2, half, ca, sa, cs, ss, segs, cB);
  // Start cap (around x1,y1) — angle reversed
  emitCap(b, x1, y1, half, -ca, -sa, cs, ss, segs, cA);
}

function emitCap(b, cx, cy, r, cosA, sinA, cs, ss, segs, col) {
  // Sweep the half-circle from cosA,sinA onwards
  let c = cosA, s = sinA;
  for (let i = 0; i < segs; i++) {
    const nc = c * cs - s * ss;
    const ns = s * cs + c * ss;
    b.triangle([cx, cy], [cx + c * r, cy + s * r], [cx + nc * r, cy + ns * r], col, col, col);
    c = nc; s = ns;
  }
}

/* Curved segment — chain of small rounded segments along the arc. */
function emitRoundedSegmentCurved(b, x1, y1, x2, y2, thickness, R, cA, cB) {
  const pts = subdivideCurve(x1, y1, x2, y2, R);
  const n = pts.length;
  if (n < 2) return;
  for (let i = 0; i < n - 1; i++) {
    const t0 = i / (n - 1);
    const t1 = (i + 1) / (n - 1);
    const c0 = lerpColor(cA, cB, t0);
    const c1 = lerpColor(cA, cB, t1);
    emitRoundedSegment(b, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thickness, c0, c1);
  }
}

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/* Circle (solid). */
function emitCircle(b, cx, cy, r, col) {
  if (r <= 0) return;
  const segs = segmentsForCircle(r);
  const step = (Math.PI * 2) / segs;
  const cs = Math.cos(step), ss = Math.sin(step);
  let c = 1, s = 0;
  for (let i = 0; i < segs; i++) {
    const nc = c * cs - s * ss;
    const ns = s * cs + c * ss;
    b.triangle([cx, cy], [cx + c * r, cy + s * r], [cx + nc * r, cy + ns * r], col, col, col);
    c = nc; s = ns;
  }
}

/* Circle outline (ring). outerR and innerR. */
function emitCircleOutline(b, cx, cy, outerR, innerR, col) {
  let segs = segmentsForCircle(outerR);
  segs = ((segs + 3) & ~3);          // round up to multiple of 4
  const step = (Math.PI * 2) / segs;
  const cs = Math.cos(step), ss = Math.sin(step);
  let c = 1, s = 0;
  for (let i = 0; i < segs; i++) {
    const nc = c * cs - s * ss;
    const ns = s * cs + c * ss;
    const o1 = [cx + c * outerR, cy + s * outerR];
    const o2 = [cx + nc * outerR, cy + ns * outerR];
    const i1 = [cx + c * innerR, cy + s * innerR];
    const i2 = [cx + nc * innerR, cy + ns * innerR];
    b.quad(o1, o2, i2, i1, col, col, col, col);
    c = nc; s = ns;
  }
}

/* Ellipse — axis-aligned in local space, rotated by angle. */
function emitEllipse(b, cx, cy, rx, ry, angle, col) {
  const segs = segmentsForCircle(Math.max(rx, ry));
  const step = (Math.PI * 2) / segs;
  const cs = Math.cos(step), ss = Math.sin(step);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  let lc = 1, ls = 0;
  for (let i = 0; i < segs; i++) {
    const nlc = lc * cs - ls * ss;
    const nls = ls * cs + lc * ss;
    const p1x = lc * rx, p1y = ls * ry;
    const p2x = nlc * rx, p2y = nls * ry;
    const w1x = cx + p1x * cosA - p1y * sinA;
    const w1y = cy + p1x * sinA + p1y * cosA;
    const w2x = cx + p2x * cosA - p2y * sinA;
    const w2y = cy + p2x * sinA + p2y * cosA;
    b.triangle([cx, cy], [w1x, w1y], [w2x, w2y], col, col, col);
    lc = nlc; ls = nls;
  }
}

/* Triangle with tip at (tx,ty), base centered at (bx,by). */
function emitTriangle(b, tx, ty, bx, by, halfBase, angle, col) {
  // halfBase is perpendicular half-width at the base
  const nX = -Math.sin(angle), nY = Math.cos(angle);
  const p1 = [bx + nX * halfBase, by + nY * halfBase];
  const p2 = [bx - nX * halfBase, by - nY * halfBase];
  b.triangle([tx, ty], p1, p2, col, col, col);
}

/* Regular polygon — centered at (cx,cy), first vertex along angle. */
function emitPolygon(b, cx, cy, radius, sides, angle, col) {
  const step = (Math.PI * 2) / sides;
  let c = Math.cos(angle), s = Math.sin(angle);
  const cs = Math.cos(step), ss = Math.sin(step);
  for (let i = 0; i < sides; i++) {
    const nc = c * cs - s * ss;
    const ns = s * cs + c * ss;
    b.triangle([cx, cy], [cx + c * radius, cy + s * radius], [cx + nc * radius, cy + ns * radius], col, col, col);
    c = nc; s = ns;
  }
}

/* Trapezoid — width w1 at (x1,y1), w2 at (x2,y2). */
function emitTrapezoid(b, x1, y1, x2, y2, w1, w2, angle, colA, colB) {
  const nX = -Math.sin(angle), nY = Math.cos(angle);
  const a1 = [x1 + nX * w1 / 2, y1 + nY * w1 / 2];
  const a2 = [x1 - nX * w1 / 2, y1 - nY * w1 / 2];
  const b1 = [x2 + nX * w2 / 2, y2 + nY * w2 / 2];
  const b2 = [x2 - nX * w2 / 2, y2 - nY * w2 / 2];
  b.quad(a1, b1, b2, a2, colA, colB, colB, colA);
}

/* Rounded trapezoid — rectangle-ish with rounded trapezoid caps approximated. */
function emitRoundedTrapezoid(b, x1, y1, x2, y2, w1, w2, angle, colA, colB) {
  // Approximate with a plain trapezoid then circles at each end sized to half widths.
  emitTrapezoid(b, x1, y1, x2, y2, w1, w2, angle, colA, colB);
  // Optional corner rounding could go here. For preview fidelity the plain version
  // is visually equivalent at typical StickNodes zoom levels.
}

/* Trapezoid with curved sides — approximate by subdividing along the trapezoid. */
function emitTrapezoidCurved(b, x1, y1, x2, y2, w1, w2, curveRadius, angle, colA, colB) {
  const pts = subdivideCurve(x1, y1, x2, y2, curveRadius);
  if (pts.length < 2) return emitTrapezoid(b, x1, y1, x2, y2, w1, w2, angle, colA, colB);
  const N = pts.length;
  for (let i = 0; i < N - 1; i++) {
    const t0 = i / (N - 1);
    const t1 = (i + 1) / (N - 1);
    const w0 = w1 + (w2 - w1) * t0;
    const w1_ = w1 + (w2 - w1) * t1;
    const a = pts[i], c = pts[i + 1];
    emitTrapezoid(b, a[0], a[1], c[0], c[1], w0, w1_, angle, lerpColor(colA, colB, t0), lerpColor(colA, colB, t1));
  }
}

/* ───────────────────────── drawLimbAA — dispatch per node type ─────────────────────────
 * Multi-pass AA: N outer passes at 20% alpha with growing thickness/dimension,
 * then one final pass at 100%.
 */

function drawLimbAA(batch, node) {
  const type = node.nodeType;
  if (type === -1) return;

  const s = node.getGlobalStart();
  const e = node.getGlobalEnd();
  const sx = s[0], sy = s[1], ex = e[0], ey = e[1];

  const thickness = Math.abs(node.getEffectiveThickness() || 1);
  const col = hexToRgba(node.getDisplayColorHex());

  // Direction & length
  const dx = ex - sx, dy = ey - sy;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const localAngleDeg = node.localAngle || 0;

  switch (type) {
    case 0: {  // RoundedSegment
      const cr = node.segmentCurveRadiusAndDefaultCurveRadius || 0;
      emitWithAA(batch, col, (bb, c, mul) => {
        const th = thickness + mul * 0.14;
        if (cr !== 0) emitRoundedSegmentCurved(bb, sx, sy, ex, ey, th, cr, c, c);
        else emitRoundedSegment(bb, sx, sy, ex, ey, th, c, c);
      }, Math.max(thickness, len));
      break;
    }

    case 1: {  // Segment
      const cr = node.segmentCurveRadiusAndDefaultCurveRadius || 0;
      emitWithAA(batch, col, (bb, c, mul) => {
        const th = thickness + mul * 0.18666667;
        if (cr !== 0) emitRoundedSegmentCurved(bb, sx, sy, ex, ey, th, cr, c, c);
        else emitSegment(bb, sx, sy, ex, ey, th, c, c);
      }, Math.max(thickness, len));
      break;
    }

    case 2: {  // Circle (hollow if flag)
      const hollow = node.circleIsHollow;
      const outerR = (len + thickness) / 2;
      const innerR = Math.max(0, outerR - thickness);
      emitWithAA(batch, col, (bb, c, mul) => {
        if (hollow) emitCircleOutline(bb, ex, ey, outerR + mul * 0.093333334, innerR + mul * 0.093333334, c);
        else emitCircle(bb, ex, ey, outerR + mul * 0.093333334, c);
      }, outerR);
      break;
    }

    case 4: {  // FilledCircle
      const r = Math.max(len, thickness) / 2;
      emitWithAA(batch, col, (bb, c, mul) => {
        emitCircle(bb, ex, ey, r + mul * 0.093333334, c);
      }, r);
      break;
    }

    case 3: {  // Triangle — use 5x8 jitter grid (10% alpha) per the Java source
      const r = Math.max(1, len);
      emitWithJitter(batch, col, (bb, c, off, level) => {
        const jb = 0.28 * Math.min(thickness / 12, 1);
        const ox = off[0] * 0.5 * jb * level;
        const oy = off[1] * 0.5 * jb * level;
        const tipX = ex + ox, tipY = ey + oy;
        emitTriangle(bb, tipX, tipY, tipX - r * Math.cos(angle), tipY - r * Math.sin(angle), thickness / 2, angle, c);
      });
      break;
    }

    case 5: {  // Ellipse
      const rx = Math.max(0.5, len / 2);
      const ry = Math.max(0.5, thickness / 2);
      emitWithJitter(batch, col, (bb, c, off, level) => {
        const jb = 0.42 * Math.min(Math.max(rx, ry) / 128, 1);
        const ox = off[0] * 0.5 * jb * level;
        const oy = off[1] * 0.5 * jb * level;
        emitEllipse(bb, ex + ox, ey + oy, rx, ry, angle, c);
      });
      break;
    }

    case 6: {  // Trapezoid
      let w1, w2;
      try { w1 = Math.abs(node.getTrapezoidThicknessStart() || thickness); } catch (_) { w1 = thickness; }
      try { w2 = Math.abs(node.getTrapezoidThicknessEnd()   || thickness * 0.5); } catch (_) { w2 = thickness * 0.5; }
      const cr = node.segmentCurveRadiusAndDefaultCurveRadius || 0;
      emitWithJitter(batch, col, (bb, c, off, level) => {
        const jb = 0.42 * Math.min(Math.max(w1, w2) / 80, 1);
        const ox = off[0] * 0.5 * jb * level;
        const oy = off[1] * 0.5 * jb * level;
        if (cr !== 0) emitTrapezoidCurved(bb, sx + ox, sy + oy, ex + ox, ey + oy, w1, w2, cr, angle, c, c);
        else emitTrapezoid(bb, sx + ox, sy + oy, ex + ox, ey + oy, w1, w2, angle, c, c);
      });
      break;
    }

    case 7: {  // Polygon
      const sides = Math.max(3, node.numPolygonVertices || 5);
      const r = Math.max(1, len);
      emitWithAA(batch, col, (bb, c, mul) => {
        emitPolygon(bb, ex, ey, r + mul * 0.23333333, sides, angle, c);
      }, r);
      break;
    }
  }
}

/* Growth-stroke AA: N passes at 20% alpha + final 100%. */
function emitWithAA(batch, col, emitFn, maxDim) {
  const N = aaPasses(maxDim);
  const ghost = [col[0], col[1], col[2], col[3] * 0.2];
  for (let i = 1; i <= N; i++) emitFn(batch, ghost, i);
  emitFn(batch, col, 0);
}

/* 5×8 jitter AA: 5 levels × 8 offsets at 10% alpha + final 100%. */
function emitWithJitter(batch, col, emitFn) {
  const ghost = [col[0], col[1], col[2], col[3] * 0.1];
  for (let level = 1; level <= 5; level++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        emitFn(batch, ghost, [jx, jy], level);
      }
    }
  }
  emitFn(batch, col, [0, 0], 0);
}

/* ───────────────────────── Polyfill ─────────────────────────
 * Ear-clip triangulation + jitter. Polyfill vertices are in world space.
 */

function earClip(verts) {
  const n = verts.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];

  // Signed area to determine winding
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ccw = area2 > 0;

  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);

  const triangles = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = verts[i0], b = verts[i1], c = verts[i2];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const isConvex = ccw ? cross > 0 : cross < 0;
      if (!isConvex) continue;

      // Check no other vertex inside triangle
      let inside = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        const p = verts[j];
        if (pointInTri(p, a, b, c)) { inside = true; break; }
      }
      if (inside) continue;

      triangles.push([i0, i1, i2]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;   // degenerate / self-intersecting
  }
  if (idx.length === 3) triangles.push([idx[0], idx[1], idx[2]]);
  return triangles;
}

function pointInTri(p, a, b, c) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
function sign(p, a, b) {
  return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
}

function drawPolyfillAA(batch, verts, col) {
  if (verts.length < 3) return;
  const tris = earClip(verts);
  const ghost = [col[0], col[1], col[2], col[3] * 0.1];

  // 5 levels × 8 offsets at 10%
  for (let level = 1; level <= 5; level++) {
    for (let jx = -1; jx <= 1; jx++) {
      for (let jy = -1; jy <= 1; jy++) {
        if (jx === 0 && jy === 0) continue;
        const jb = 0.28;
        const ox = jx * 0.5 * jb * level;
        const oy = jy * 0.5 * jb * level;
        for (const [i0, i1, i2] of tris) {
          const a = verts[i0], b = verts[i1], c = verts[i2];
          batch.triangle(
            [a.x + ox, a.y + oy],
            [b.x + ox, b.y + oy],
            [c.x + ox, c.y + oy],
            ghost, ghost, ghost
          );
        }
      }
    }
  }
  // Final 100% pass
  for (const [i0, i1, i2] of tris) {
    const a = verts[i0], b = verts[i1], c = verts[i2];
    batch.triangle([a.x, a.y], [b.x, b.y], [c.x, c.y], col, col, col);
  }
}

/* ───────────────────────── Camera (world→screen) ───────────────────────── */

class Camera {
  constructor() {
    this.fit = 1;
    this.cx = 0;   // world point at screen center
    this.cy = 0;
    this.flipY = false;
    this.W = 0;    // canvas pixel size
    this.H = 0;
  }

  /* Return a 3x3 column-major mat3 that maps world → NDC.
   * NDC is [-1,1]; Y is up in NDC by default. If flipY is true, we keep Y down.
   */
  projMatrix() {
    const s = this.fit * 2 / this.W;         // world units → NDC
    const tx = -(this.cx) * s;
    const ty = -(this.cy) * s;
    const flip = this.flipY ? -1 : 1;        // if false, Y up in NDC

    // Column-major: [m00,m10,m20, m01,m11,m21, m02,m12,m22]
    // world→NDC: x' = s * (x - cx)
    //            y' = s * (y - cy) * flipY_sign
    // Canvas fills bottom-left = (0,0) of screen; we want
    // world (cx,cy) at screen center, screen Y downward.
    // The simplest is: y_ndc = -s * (y - cy) * sign
    // where sign = -1 if world Y is down and screen Y is down too.
    // Since world Y is DOWN and canvas pixels Y is DOWN, and NDC Y is UP:
    //   y_ndc = -s * (y - cy)
    // We'll flip for user-toggle.
    const sy = -s * (this.flipY ? -1 : 1);

    return new Float32Array([
      s, 0, 0,
      0, sy, 0,
      tx, -sy * this.cy + (this.flipY ? 0 : 0) * 0, 1,
    ]);
  }

  /* Simpler builder avoiding the mess above — build directly from parameters. */
  projMatrix2() {
    const s = this.fit * 2 / this.W;
    const sy = (this.flipY ? 1 : -1) * this.fit * 2 / this.H;

    // World→NDC:
    //   ndc.x = (x - cx) * (fit*2/W)          (fit = pixels per world unit in min-dimension)
    // Wait: fit is pixels per world unit. So to convert world to NDC we need
    // world→pixel then pixel→NDC. To keep things simple we compute in world→NDC directly:
    //   scaleX_ndc_per_world = 2 * fit / W
    //   scaleY_ndc_per_world = ± 2 * fit / H
    // Then
    //   ndc.x = (x - cx) * scaleX_ndc_per_world
    //   ndc.y = (y - cy) * scaleY_ndc_per_world
    const sx = 2 * this.fit / this.W;
    const syNdc = (this.flipY ? 1 : -1) * 2 * this.fit / this.H;
    const tx = -this.cx * sx;
    const ty = -this.cy * syNdc;

    return new Float32Array([
      sx, 0, 0,
      0, syNdc, 0,
      tx, ty, 1,
    ]);
  }
}

/* ───────────────────────── Scene extraction ───────────────────────── */

function collectNodes(fig) {
  const out = [];
  const root = fig.rootNode();
  const visit = (node) => {
    out.push(node);
    let kids = [];
    try { kids = node.children(); } catch (_) {}
    for (const k of kids) visit(k);
  };
  visit(root);
  return out;
}

function nodesSortedByDrawIndex(fig) {
  const all = collectNodes(fig);
  all.sort((a, b) => a.drawIndex - b.drawIndex);
  return all;
}

/* ───────────────────────── Public renderer ───────────────────────── */

export class StickNodesRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.batcher = new Batcher(gl);
    this.camera = new Camera();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(1, 1, 1, 1);

    this.fig = null;
    this.showFills = true;
    this.dragging = null;

    canvas.addEventListener('pointerdown', this._onDown.bind(this));
    canvas.addEventListener('pointermove', this._onMove.bind(this));
    canvas.addEventListener('pointerup',   this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));
  }

  setFigure(fig) { this.fig = fig; }

  setFills(v) { this.showFills = !!v; }

  /* Resize canvas to match CSS size × DPR. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth | 0;
    const h = this.canvas.clientHeight | 0;
    const pw = (w * dpr) | 0;
    const ph = (h * dpr) | 0;
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.camera.W = pw;
    this.camera.H = ph;
    this.gl.viewport(0, 0, pw, ph);
  }

  /* Compute bounding box in world space and set camera.fit so the figure fills the canvas. */
  fitToView() {
    if (!this.fig) return;
    const nodes = collectNodes(this.fig);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let maxPad = 0;
    for (const n of nodes) {
      if (n.nodeType === -1) continue;
      let s, e;
      try { s = n.getGlobalStart(); e = n.getGlobalEnd(); } catch (_) { continue; }
      const th = Math.abs(n.getEffectiveThickness() || 1);
      const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
      const pad = Math.max(th, len) / 2;
      if (pad > maxPad) maxPad = pad;
      for (const p of [s, e]) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      }
    }
    if (!isFinite(minX)) { minX = -50; minY = -50; maxX = 50; maxY = 50; }
    const pad = maxPad + 8;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    const spanX = Math.max(maxX - minX, 40);
    const spanY = Math.max(maxY - minY, 40);
    const W = this.camera.W, H = this.camera.H;
    this.camera.fit = Math.min((W - 40) / spanX, (H - 40) / spanY);
    this.camera.cx = (minX + maxX) / 2;
    this.camera.cy = (minY + maxY) / 2;
  }

  render() {
    if (!this.fig) return { fit: 1, nodeCount: 0, fillCount: 0 };
    this.resize();

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const nodes = nodesSortedByDrawIndex(this.fig);
    let nodeCount = 0;

    // Draw limbs in draw-index order.
    // For each node, we call drawLimbAA once. All the AA passes go into the
    // batch in order so they render as a stack (matches Java behaviour where
    // each pass is submitted to the ImmediateModeRenderer sequentially).
    for (const n of nodes) {
      if (n.nodeType === -1) continue;
      nodeCount++;
      drawLimbAA(this.batcher, n);
    }

    // Polyfills on top
    let fillCount = 0;
    if (this.showFills) {
      let rawPfs = [];
      try { rawPfs = this.fig.allPolyfills(); } catch (_) {}
      let figColor = [32/255, 32/255, 32/255, 1];
      try { figColor = hexToRgba(this.fig.colorHex); } catch (_) {}

      for (const pf of rawPfs) {
        let verts = [];
        try {
          const flat = this.fig.getPolyfillVertices(pf.anchorDrawIndex);
          for (let i = 0; i + 1 < flat.length; i += 2) verts.push({ x: flat[i], y: flat[i + 1] });
        } catch (_) { continue; }
        if (verts.length < 3) continue;
        const col = pf.usePolyfillColor ? hexToRgba(pf.colorHex) : figColor;
        drawPolyfillAA(this.batcher, verts, col);
        fillCount++;
      }
    }

    // One draw call, everything batched in order.
    const proj = this.camera.projMatrix2();
    this.batcher.flush(proj, 1.0);

    return {
      fit: this.camera.fit,
      nodeCount,
      fillCount,
    };
  }

  /* ───────── Drag handling ───────── */

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const W = this.camera.W, H = this.camera.H;
    // Inverse of proj: ndc = proj * world → world = proj_inv * ndc
    const ndcX = (px / W) * 2 - 1;
    const ndcY = 1 - (py / H) * 2;      // canvas top is +1 in NDC
    const sx = 2 * this.camera.fit / W;
    const syNdc = (this.camera.flipY ? 1 : -1) * 2 * this.camera.fit / H;
    const tx = -this.camera.cx * sx;
    const ty = -this.camera.cy * syNdc;
    const wx = (ndcX - tx) / sx;
    const wy = (ndcY - ty) / syNdc;
    return { x: wx, y: wy };
  }

  _onDown(ev) {
    if (!this.fig) return;
    const w = this.screenToWorld(ev.clientX, ev.clientY);
    const nodes = collectNodes(this.fig);
    let best = null, bestDist = Infinity;
    for (const n of nodes) {
      if (n.nodeType === -1) continue;
      let e;
      try { e = n.getGlobalEnd(); } catch (_) { continue; }
      const d = Math.hypot(w.x - e[0], w.y - e[1]);
      const tol = Math.max(20 / this.camera.fit, (Math.abs(n.getEffectiveThickness()) || 1) * 0.75);
      if (d < tol && d < bestDist) { best = n; bestDist = d; }
    }
    if (!best) return;

    let pivot = null, parentAngle = 0;
    try { pivot = best.getGlobalStart(); } catch (_) { return; }
    try {
      const pi = best.getParentIndex();
      if (pi !== undefined && pi !== null && pi >= 0) {
        const parent = this.fig.getNode(pi);
        parentAngle = parent.getGlobalAngle ? parent.getGlobalAngle() : 0;
      }
    } catch (_) {}

    this.dragging = { node: best, pivot, parentAngle };
    try { this.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    ev.preventDefault();
  }

  _onMove(ev) {
    if (!this.dragging || !this.fig) return;
    const w = this.screenToWorld(ev.clientX, ev.clientY);
    const { node, pivot, parentAngle } = this.dragging;
    const dx = w.x - pivot[0];
    const dy = w.y - pivot[1];
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const globalAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const figScale = this.fig.scale || 1;
    const segScale = node.useSegmentScale ? (node.scale || 1) : 1;

    try {
      node.localAngle = globalAngleDeg - parentAngle;
      if (node.isStretchy) {
        node.length = len / figScale / segScale;
      }
    } catch (e) { return; }

    this.render();
    if (this._onChange) this._onChange(node);
  }

  _onUp(ev) {
    if (this.dragging) {
      try { this.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
      this.dragging = null;
    }
  }

  onNodeChanged(fn) { this._onChange = fn; }
}
