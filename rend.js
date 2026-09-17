/* ============================================================================
 * StickNodes Studio — renderer.js (WebGL2 final renderer)
 * ============================================================================
 *
 * Source-of-truth split
 * ---------------------
 *  sticknodes-rs WASM:
 *    - .nodes parsing / serialization
 *    - node hierarchy
 *    - global/local transforms
 *    - angle/drag locks
 *    - smart stretch
 *    - effective thickness / scale
 *    - polyfill data / triangulation
 *
 *  This renderer:
 *    - ports the geometry concepts used by StickNode + SNShapeRenderer
 *    - converts shapes to explicit GPU triangles
 *    - supports per-vertex gradients
 *    - renders polyfills as cached triangle meshes
 *    - performs camera/pan/zoom/flip
 *    - performs editor hit testing and overlays
 *
 * Coordinate system: StickNodes Y-down.
 *
 * The public StickNodesRenderer API is intentionally compatible with the
 * previous renderer so the supplied index2.html can continue to use:
 *
 *   new StickNodesRenderer(canvas)
 *   setFigure(), setFills(), setDragEnabled(), setShowPoints(), setFlipY()
 *   onNodeChanged(), onSelect(), render(), fitView(), resetView(), zoomBy()
 *   getSelectedIndex()
 *
 * ========================================================================== */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const EPS = 1e-7;

const NODE = Object.freeze({
  ROUNDED_SEGMENT: 0,
  SEGMENT: 1,
  CIRCLE: 2,
  TRIANGLE: 3,
  FILLED_CIRCLE: 4,
  ELLIPSE: 5,
  TRAPEZOID: 6,
  POLYGON: 7,
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const deg = v => finite(v) * DEG;

function hexToRgba(hex) {
  let h = String(hex ?? "#000000FF").replace(/^#/, "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("") + "FF";
  else if (h.length === 4) h = h.split("").map(c => c + c).join("");
  else if (h.length === 6) h += "FF";
  while (h.length < 8) h += "F";
  const a = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    parseInt(h.slice(6, 8), 16),
  ];
  return a.map((v, i) => Number.isFinite(v) ? v / 255 : (i === 3 ? 1 : 0));
}

function safe(fn, fallback = null) {
  try { return fn(); } catch (_) { return fallback; }
}

function v2(x, y) { return [finite(x), finite(y)]; }

function length2(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a * 0.5;
}

function dedupe(points) {
  const out = [];
  for (const p of points) {
    if (!out.length || Math.hypot(p[0] - out[out.length-1][0],
                                   p[1] - out[out.length-1][1]) > 1e-6) {
      out.push(p);
    }
  }
  if (out.length > 1 &&
      Math.hypot(out[0][0] - out[out.length-1][0],
                 out[0][1] - out[out.length-1][1]) < 1e-6) out.pop();
  return out;
}

/* -------------------------------------------------------------------------- *
 * Java/SNShapeRenderer-style tessellation helpers
 * -------------------------------------------------------------------------- */

function segmentsForCircle(radius) {
  const r = Math.max(0.01, Math.abs(radius));
  /* SNShapeRenderer uses adaptive segment counts for circles. */
  return clamp(Math.ceil(Math.sqrt(r) * 1.7), 12, 128);
}

function segmentsForCurve(radius, precision = 12, sweep = TAU) {
  const r = Math.max(1, Math.abs(radius));
  const p = Math.max(0.25, Math.abs(precision) || 12);
  return clamp(Math.ceil(Math.abs(sweep) * Math.sqrt(r / p) * 1.35), 6, 192);
}

function circlePoints(cx, cy, r, n, start = 0) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = start + i * TAU / n;
    out[i] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  return out;
}

function capsule(sx, sy, ex, ey, thickness, rounded = true, quality = 1) {
  const dx = ex - sx, dy = ey - sy;
  const L = Math.hypot(dx, dy);
  const r = Math.max(0.005, Math.abs(thickness) * 0.5);

  if (L < EPS) return circlePoints(sx, sy, r, Math.max(16, Math.ceil(24 * quality)));

  const ux = dx / L, uy = dy / L;
  const px = -uy, py = ux;

  if (!rounded) {
    return [
      [sx + px*r, sy + py*r],
      [ex + px*r, ey + py*r],
      [ex - px*r, ey - py*r],
      [sx - px*r, sy - py*r],
    ];
  }

  const n = clamp(Math.ceil(12 * quality), 8, 64);
  const out = [];
  const a = Math.atan2(uy, ux);

  /* End semicircle. */
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = a - Math.PI/2 + Math.PI*t;
    out.push([ex + Math.cos(ang)*r, ey + Math.sin(ang)*r]);
  }

  /* Start semicircle. */
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = a + Math.PI/2 + Math.PI*t;
    out.push([sx + Math.cos(ang)*r, sy + Math.sin(ang)*r]);
  }

  return dedupe(out);
}

/*
 * Port of the conceptual curve-center calculation used by StickNode.
 * Positive/negative radius chooses the side of the chord.  A radius smaller
 * than half the chord cannot form the requested circular arc, so the straight
 * geometry is retained.
 */
function curveCenterline(sx, sy, ex, ey, radius, precision = 12, circulize = false) {
  const dx = ex-sx, dy = ey-sy;
  const L = Math.hypot(dx, dy);
  const R0 = finite(radius);

  if (L < 0.5 || Math.abs(R0) < 0.5) return [[sx,sy],[ex,ey]];

  let R = Math.abs(R0);
  if (circulize) R = Math.max(R, L * 0.5 + 0.0001);
  if (R < L * 0.5) return [[sx,sy],[ex,ey]];

  const h = Math.sqrt(Math.max(0, R*R - (L*0.5)*(L*0.5)));
  const mx = (sx+ex)*0.5, my = (sy+ey)*0.5;
  const nx = -dy/L, ny = dx/L;
  const side = R0 >= 0 ? 1 : -1;
  const cx = mx + nx*h*side;
  const cy = my + ny*h*side;

  const a0 = Math.atan2(sy-cy, sx-cx);
  const a1 = Math.atan2(ey-cy, ex-cx);

  let sweep = a1-a0;
  if (side > 0) {
    while (sweep <= 0) sweep += TAU;
    if (sweep > Math.PI) sweep -= TAU;
  } else {
    while (sweep >= 0) sweep -= TAU;
    if (sweep < -Math.PI) sweep += TAU;
  }

  const n = Math.max(4, segmentsForCurve(R, precision, sweep));
  const pts = [];
  for (let i=0; i<=n; i++) {
    const t = i/n;
    const a = a0 + sweep*t;
    pts.push([cx + Math.cos(a)*R, cy + Math.sin(a)*R]);
  }
  pts[0] = [sx,sy];
  pts[pts.length-1] = [ex,ey];
  return pts;
}

function curvedCapsule(sx, sy, ex, ey, thickness, radius, precision, circulize) {
  const center = curveCenterline(sx,sy,ex,ey,radius,precision,circulize);
  const r = Math.max(0.005, Math.abs(thickness)*0.5);
  if (center.length < 2) return [];

  const left = [], right = [];
  for (let i=0; i<center.length; i++) {
    const p = center[i];
    const prev = center[Math.max(0,i-1)];
    const next = center[Math.min(center.length-1,i+1)];
    const dx = next[0]-prev[0], dy = next[1]-prev[1];
    const L = Math.hypot(dx,dy) || 1;
    const nx = -dy/L, ny = dx/L;
    left.push([p[0]+nx*r,p[1]+ny*r]);
    right.push([p[0]-nx*r,p[1]-ny*r]);
  }

  const poly = left.slice();

  /* Rounded end. */
  const end = center[center.length-1];
  const prev = center[center.length-2];
  const ea = Math.atan2(end[1]-prev[1], end[0]-prev[0]);
  const en = Math.max(8, Math.ceil(10 * Math.min(2, r/3 + 1)));
  for (let i=1; i<en; i++) {
    const a = ea - Math.PI/2 + Math.PI*i/en;
    poly.push([end[0]+Math.cos(a)*r,end[1]+Math.sin(a)*r]);
  }

  for (let i=right.length-1; i>=0; i--) poly.push(right[i]);

  const start = center[0];
  const nxt = center[1];
  const sa = Math.atan2(nxt[1]-start[1], nxt[0]-start[0]);
  for (let i=1; i<en; i++) {
    const a = sa + Math.PI/2 + Math.PI*i/en;
    poly.push([start[0]+Math.cos(a)*r,start[1]+Math.sin(a)*r]);
  }
  return dedupe(poly);
}

function triangleGeometry(sx,sy,ex,ey,thickness, flipped=false, upsideDown=false) {
  const dx=ex-sx,dy=ey-sy,L=Math.hypot(dx,dy)||1;
  const px=-dy/L, py=dx/L;
  let half=Math.max(0.01,Math.abs(thickness))*0.5;

  /*
   * StickNode's triangle has the tip at the end and its base around the
   * start.  The two flags reverse the corresponding orientation.
   */
  if (upsideDown) half = -half;
  const a=[ex,ey];
  const b=[sx+px*half,sy+py*half];
  const c=[sx-px*half,sy-py*half];
  if (flipped) return [a,c,b];
  return [a,b,c];
}

function trapezoidGeometry(sx,sy,ex,ey,w1,w2,roundedStart=false,roundedEnd=false) {
  const dx=ex-sx,dy=ey-sy,L=Math.hypot(dx,dy)||1;
  const nx=-dy/L,ny=dx/L;
  const A=Math.max(0.01,Math.abs(w1))*0.5;
  const B=Math.max(0.01,Math.abs(w2))*0.5;
  const base=[
    [sx+nx*A,sy+ny*A],
    [ex+nx*B,ey+ny*B],
    [ex-nx*B,ey-ny*B],
    [sx-nx*A,sy-ny*A]
  ];

  if (!roundedStart && !roundedEnd) return base;

  /*
   * Rounded ends are tessellated by adding semicircular caps around the
   * corresponding end. This follows the geometry intent of
   * myRoundedTrapezoid rather than relying on Canvas lineJoin.
   */
  const out=[];
  const a=Math.atan2(dy,dx);
  if (roundedStart) {
    const n=10;
    for(let i=0;i<=n;i++){
      const t=i/n,ang=a+Math.PI/2+Math.PI*t;
      out.push([sx+Math.cos(ang)*A,sy+Math.sin(ang)*A]);
    }
  } else {
    out.push(base[0],base[3]);
  }

  if (roundedEnd) {
    const n=10;
    for(let i=0;i<=n;i++){
      const t=i/n,ang=a-Math.PI/2+Math.PI*t;
      out.push([ex+Math.cos(ang)*B,ey+Math.sin(ang)*B]);
    }
  } else {
    out.push(base[1],base[2]);
  }
  return dedupe(out);
}

/* -------------------------------------------------------------------------- *
 * CPU tessellation -> indexed triangles
 * -------------------------------------------------------------------------- */

function triangulateFan(points) {
  const pts=dedupe(points);
  if(pts.length<3) return {points:pts,indices:[]};

  /*
   * Convex geometry (segments, circles, ellipse approximations, triangles and
   * trapezoids) can use a fan. Polyfills come from WASM already triangulated.
   */
  const indices=[];
  for(let i=1;i<pts.length-1;i++) indices.push(0,i,i+1);
  return {points:pts,indices};
}

function addMesh(mesh, points, indices, c0, c1=null, gradientAxis=null) {
  const base = mesh.vertices.length / 6;
  const n=points.length;
  for(let i=0;i<n;i++){
    const p=points[i];
    let c=c0;
    if(c1){
      let t=0;
      if(gradientAxis === 'x') t=clamp((p[0]-gradientAxis.min)/(gradientAxis.max-gradientAxis.min||1),0,1);
      else if(gradientAxis === 'y') t=clamp((p[1]-gradientAxis.min)/(gradientAxis.max-gradientAxis.min||1),0,1);
      c=[
        c0[0]*(1-t)+c1[0]*t,
        c0[1]*(1-t)+c1[1]*t,
        c0[2]*(1-t)+c1[2]*t,
        c0[3]*(1-t)+c1[3]*t
      ];
    }
    mesh.vertices.push(p[0],p[1],c[0],c[1],c[2],c[3]);
  }
  for(const i of indices) mesh.indices.push(base+i);
}

function newMesh() {
  return {vertices:[],indices:[]};
}

function gradientInfo(node, fallbackColor) {
  let enabled=false, reverse=false, mode=null, second=null;
  enabled=!!safe(()=>node.useGradient,false);
  reverse=!!safe(()=>node.reverseGradient,false);
  mode=safe(()=>node.gradientMode,null);
  second=safe(()=>node.gradientColorHex,null);
  if(!enabled || !second) return null;
  const c0=hexToRgba(reverse ? second : safe(()=>node.colorHex,"#000000FF"));
  const c1=hexToRgba(reverse ? safe(()=>node.colorHex,"#000000FF") : second);

  /* Java exposes X/Y interpolators. Numeric mode conventions vary by build;
     support common string and numeric forms without making geometry depend on
     them. */
  const axis = (mode === "Y" || mode === "y" || mode === 1) ? "y" : "x";
  return {c0,c1,axis};
}

function nodeMesh(s) {
  const mesh=newMesh();
  const color=s.color;
  const g=s.gradient;

  function put(points, indices, axisPoints=points) {
    let gi=null;
    if(g){
      let min=Infinity,max=-Infinity;
      for(const p of axisPoints){
        const q=g.axis==='x'?p[0]:p[1];
        min=Math.min(min,q);max=Math.max(max,q);
      }
      gi={min,max};
    }
    addMesh(mesh,points,indices,g?.c0||color,g?.c1||null,g?{min:gi.min,max:gi.max}:null);
  }

  switch(s.type){
    case NODE.ROUNDED_SEGMENT: {
      let pts;
      if(Math.abs(s.curveRadius)>0.5)
        pts=curvedCapsule(s.sx,s.sy,s.ex,s.ey,s.thickness,s.curveRadius,s.curvePrecision,s.curveCirculization);
      else
        pts=capsule(s.sx,s.sy,s.ex,s.ey,s.thickness,true,1);
      const t=triangulateFan(pts); put(t.points,t.indices); break;
    }

    case NODE.SEGMENT: {
      let pts;
      if(Math.abs(s.curveRadius)>0.5) {
        const center=curveCenterline(s.sx,s.sy,s.ex,s.ey,s.curveRadius,s.curvePrecision,s.curveCirculization);
        const r=Math.max(0.01,Math.abs(s.thickness)*0.5);
        const left=[],right=[];
        for(let i=0;i<center.length;i++){
          const p=center[i],prev=center[Math.max(0,i-1)],next=center[Math.min(center.length-1,i+1)];
          const dx=next[0]-prev[0],dy=next[1]-prev[1],L=Math.hypot(dx,dy)||1;
          const nx=-dy/L,ny=dx/L;
          left.push([p[0]+nx*r,p[1]+ny*r]);
          right.push([p[0]-nx*r,p[1]-ny*r]);
        }
        pts=left.concat(right.reverse());
      } else pts=capsule(s.sx,s.sy,s.ex,s.ey,s.thickness,false,1);
      const t=triangulateFan(pts); put(t.points,t.indices); break;
    }

    case NODE.CIRCLE: {
      const L=Math.hypot(s.ex-s.sx,s.ey-s.sy);
      const inner=Math.abs(s.thickness)*0.5;
      const outer=(L+Math.abs(s.thickness))*0.5;
      const n=segmentsForCircle(outer);
      if(s.hollow){
        const base=mesh.vertices.length/6;
        for(let i=0;i<n;i++){
          const a=i*TAU/n;
          const co=Math.cos(a),si=Math.sin(a);
          const c=g?.c0||color;
          mesh.vertices.push(
            s.ex+co*outer,s.ey+si*outer,...c,
            s.ex+co*inner,s.ey+si*inner,...c
          );
        }
        for(let i=0;i<n;i++){
          const j=(i+1)%n;
          mesh.indices.push(base+i*2,base+j*2,base+i*2+1,
                             base+j*2,base+j*2+1,base+i*2+1);
        }
      } else {
        const pts=circlePoints(s.ex,s.ey,outer,n);
        const t=triangulateFan(pts); put(t.points,t.indices);
      }
      break;
    }

    case NODE.FILLED_CIRCLE: {
      const r=Math.max(Math.abs(s.thickness),Math.abs(s.len))/2;
      const pts=circlePoints(s.ex,s.ey,r,segmentsForCircle(r));
      const t=triangulateFan(pts); put(t.points,t.indices); break;
    }

    case NODE.TRIANGLE: {
      const pts=triangleGeometry(s.sx,s.sy,s.ex,s.ey,s.thickness,s.triangleFlipped,s.triangleUpsideDown);
      put(pts,[0,1,2]); break;
    }

    case NODE.ELLIPSE: {
      const L=Math.hypot(s.ex-s.sx,s.ey-s.sy);
      const rx=Math.max(0.01,L*0.5);
      const ry=Math.max(0.01,Math.abs(s.thickness)*0.5);
      const a=Math.atan2(s.ey-s.sy,s.ex-s.sx)-Math.PI/2;
      const n=segmentsForCircle(Math.max(rx,ry));
      const pts=[];
      for(let i=0;i<n;i++){
        const t=i*TAU/n,ct=Math.cos(t),st=Math.sin(t);
        pts.push([s.ex+ct*rx*Math.cos(a)-st*ry*Math.sin(a),
                  s.ey+ct*rx*Math.sin(a)+st*ry*Math.cos(a)]);
      }
      const tri=triangulateFan(pts); put(tri.points,tri.indices); break;
    }

    case NODE.TRAPEZOID: {
      const w1=s.trapStart>0?s.trapStart:s.thickness;
      const w2=s.trapEnd>0?s.trapEnd:s.thickness*0.5;
      const pts=trapezoidGeometry(s.sx,s.sy,s.ex,s.ey,w1,w2,s.roundStart,s.roundEnd);
      const tri=triangulateFan(pts); put(tri.points,tri.indices); break;
    }

    case NODE.POLYGON: {
      const r=Math.max(0.01,s.len);
      const n=clamp(Math.round(s.numPoly||5),3,64);
      const a=Math.atan2(s.ey-s.sy,s.ex-s.sx);
      const pts=circlePoints(s.ex,s.ey,r,n,a);
      const tri=triangulateFan(pts); put(tri.points,tri.indices); break;
    }
  }
  return mesh;
}

/* -------------------------------------------------------------------------- *
 * WebGL2
 * -------------------------------------------------------------------------- */

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec4 a_color;
uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_zoom;
uniform float u_flip;
out vec4 v_color;
void main(){
  vec2 p = a_pos - u_camera;
  p.x *= u_zoom;
  p.y *= u_zoom * u_flip;
  vec2 ndc = vec2(p.x / (u_resolution.x*0.5),
                  p.y / (u_resolution.y*0.5));
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_color = a_color;
}`;

const FS = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main(){ outColor=v_color; }`;

const OVERLAY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec4 a_color;
uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_zoom;
uniform float u_flip;
out vec4 v_color;
void main(){
  vec2 p=a_pos-u_camera;
  p.x*=u_zoom;
  p.y*=u_zoom*u_flip;
  vec2 ndc=vec2(p.x/(u_resolution.x*0.5),p.y/(u_resolution.y*0.5));
  gl_Position=vec4(ndc.x,-ndc.y,0.0,1.0);
  v_color=a_color;
}`;

function shader(gl,type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
    const msg=gl.getShaderInfoLog(s);
    gl.deleteShader(s); throw new Error("WebGL shader: "+msg);
  }
  return s;
}

function program(gl,vs,fs){
  const p=gl.createProgram();
  gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));
  gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    const msg=gl.getProgramInfoLog(p);
    gl.deleteProgram(p); throw new Error("WebGL program: "+msg);
  }
  return p;
}

class GLMesh {
  constructor(gl){
    this.gl=gl;
    this.vao=gl.createVertexArray();
    this.vbo=gl.createBuffer();
    this.ibo=gl.createBuffer();
    this.count=0;
  }

  upload(vertices,indices){
    const gl=this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);
    this.count=indices.length;
    gl.bindVertexArray(null);
  }

  draw(){
    if(!this.count)return;
    const gl=this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);
    gl.bindVertexArray(null);
  }

  dispose(){
    const gl=this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ibo);
  }
}

/* -------------------------------------------------------------------------- *
 * Editor overlays: deliberately separate from figure geometry.
 * -------------------------------------------------------------------------- */

function circleLine(cx,cy,r,n=24){
  const pts=[];
  for(let i=0;i<n;i++){
    const a=i*TAU/n;
    pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);
  }
  return pts;
}

function addLineStrip(out, points, color, closed=false){
  if(points.length<2)return;
  for(let i=0;i<points.length-1;i++){
    out.push(points[i][0],points[i][1],...color,
              points[i+1][0],points[i+1][1],...color);
  }
  if(closed){
    const a=points[points.length-1],b=points[0];
    out.push(a[0],a[1],...color,b[0],b[1],...color);
  }
}

function overlayMarker(out,x,y,r,color){
  addLineStrip(out,circleLine(x,y,r,24),color,true);
}

function diamondMarker(out,x,y,r,color){
  const p=[[x,y-r],[x+r,y],[x,y+r],[x-r,y]];
  addLineStrip(out,p,color,true);
}

/* -------------------------------------------------------------------------- *
 * StickNodesRenderer
 * -------------------------------------------------------------------------- */

export class StickNodesRenderer {
  constructor(canvas){
    this.canvas=canvas;
    this.gl=canvas.getContext("webgl2",{
      alpha:false,
      antialias:true,
      premultipliedAlpha:false,
      preserveDrawingBuffer:false,
      powerPreference:"high-performance"
    });

    if(!this.gl){
      throw new Error("WebGL2 is required for the StickNodes renderer");
    }

    this.program=program(this.gl,VS,FS);
    this.overlayProgram=program(this.gl,OVERLAY_VS,FS);

    this.loc={
      res:this.gl.getUniformLocation(this.program,"u_resolution"),
      cam:this.gl.getUniformLocation(this.program,"u_camera"),
      zoom:this.gl.getUniformLocation(this.program,"u_zoom"),
      flip:this.gl.getUniformLocation(this.program,"u_flip"),
      ores:this.gl.getUniformLocation(this.overlayProgram,"u_resolution"),
      ocam:this.gl.getUniformLocation(this.overlayProgram,"u_camera"),
      ozoom:this.gl.getUniformLocation(this.overlayProgram,"u_zoom"),
      oflip:this.gl.getUniformLocation(this.overlayProgram,"u_flip"),
    };

    this.overlayVAO=this.gl.createVertexArray();
    this.overlayVBO=this.gl.createBuffer();
    this.sceneMeshes=[];
    this.polyfillMeshes=[];

    this.fig=null;
    this.showFills=true;
    this.showPoints=true;
    this.dragEnabled=true;
    this.flipY=false;
    this.selectedIndex=null;

    this.view={cx:0,cy:0,zoom:1,fitted:false};
    this.sceneCache=null;
    this.dirty=true;

    this._onNodeChanged=null;
    this._onSelect=null;

    this.pointers=new Map();
    this.activeDrag=null;
    this.activePan=null;
    this.pinch=null;

    this._down=this._down.bind(this);
    this._move=this._move.bind(this);
    this._up=this._up.bind(this);
    this._wheel=this._wheel.bind(this);

    canvas.addEventListener("pointerdown",this._down,{passive:false});
    canvas.addEventListener("pointermove",this._move,{passive:false});
    canvas.addEventListener("pointerup",this._up,{passive:false});
    canvas.addEventListener("pointercancel",this._up,{passive:false});
    canvas.addEventListener("wheel",this._wheel,{passive:false});

    this._resizeObserver=typeof ResizeObserver!=="undefined"
      ? new ResizeObserver(()=>this._ensureSize()) : null;
    if(this._resizeObserver)this._resizeObserver.observe(canvas.parentElement||canvas);

    this._ensureSize();
    this._configureGL();
  }

  _configureGL(){
    const gl=this.gl;
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(1,1,1,1);
  }

  setFigure(fig){
    this.fig=fig;
    this.sceneCache=null;
    this.view.fitted=false;
    this.selectedIndex=null;
    this.dirty=true;
    this._disposeSceneMeshes();
  }

  setFills(v){this.showFills=!!v;this.sceneCache=null;this.dirty=true;}
  setShowPoints(v){this.showPoints=!!v;this.dirty=true;}
  setDragEnabled(v){this.dragEnabled=!!v;}
  setFlipY(v){this.flipY=!!v;this.dirty=true;}

  onNodeChanged(fn){this._onNodeChanged=typeof fn==="function"?fn:null;}
  onSelect(fn){this._onSelect=typeof fn==="function"?fn:null;}
  getSelectedIndex(){return this.selectedIndex;}

  _ensureSize(){
    const dpr=Math.max(1,Math.min(4,window.devicePixelRatio||1));
    const el=this.canvas.parentElement||this.canvas;
    const r=el.getBoundingClientRect();
    const w=Math.max(1,Math.floor(r.width*dpr));
    const h=Math.max(1,Math.floor(r.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;this.canvas.height=h;
      this.canvas.style.width=r.width+"px";
      this.canvas.style.height=r.height+"px";
      this.dirty=true;
    }
  }

  _disposeSceneMeshes(){
    for(const m of this.sceneMeshes)m.dispose();
    for(const m of this.polyfillMeshes)m.dispose();
    this.sceneMeshes=[];
    this.polyfillMeshes=[];
  }

  _extractScene(){
    if(this.sceneCache)return this.sceneCache;
    if(!this.fig)return {scene:[],polyfills:[],figScale:1};

    const figScale=finite(safe(()=>this.fig.scale,1),1)||1;
    const scene=[];

    const nodes=safe(()=>this.fig.allNodes(),[]);
    for(const n of nodes){
      const type=finite(safe(()=>n.nodeType,-999),-999);
      if(type===-1||type<0||type>7)continue;

      const start=safe(()=>n.getGlobalStart(),null);
      const end=safe(()=>n.getGlobalEnd(),null);
      if(!start||!end)continue;

      const thickness=Math.abs(finite(
        safe(()=>n.getEffectiveThickness(),safe(()=>n.thickness,1)),1
      ));

      const color=hexToRgba(safe(()=>n.getDisplayColorHex(),
                              safe(()=>n.colorHex,"#000000FF")));

      const gradient=gradientInfo(n,color);

      scene.push({
        node:n,
        type,
        drawIndex:finite(safe(()=>n.drawIndex,-1),-1),
        sx:finite(start[0])*figScale,
        sy:finite(start[1])*figScale,
        ex:finite(end[0])*figScale,
        ey:finite(end[1])*figScale,
        len:Math.hypot(finite(end[0])-finite(start[0]),
                       finite(end[1])-finite(start[1]))*figScale,
        thickness:thickness*figScale,
        color,
        gradient,
        hollow:!!safe(()=>n.circleIsHollow,false),
        trapStart:finite(safe(()=>n.trapezoidThicknessStart,0),0)*figScale,
        trapEnd:finite(safe(()=>n.trapezoidThicknessEnd,0),0)*figScale,
        roundStart:!!safe(()=>n.trapezoidIsRoundedStart,false),
        roundEnd:!!safe(()=>n.trapezoidIsRoundedEnd,false),
        numPoly:finite(safe(()=>n.numPolygonVertices,5),5),
        curveRadius:finite(safe(()=>n.segmentCurveRadiusAndDefaultCurveRadius,0),0)*figScale,
        curvePrecision:finite(safe(()=>n.segmentCurvePolyfillPrecision,12),12),
        curveCirculization:!!safe(()=>n.curveCirculization,false),
        triangleFlipped:!!safe(()=>n.triangleFlipped,false),
        triangleUpsideDown:!!safe(()=>n.triangleUpsideDown,false),
        isStatic:!!safe(()=>n.isStatic,false),
        isAngleLocked:!!safe(()=>n.isAngleLocked,false),
        hasConnector:!!safe(()=>n.hasConnector,false),
        useSegmentColor:!!safe(()=>n.useSegmentColor,false),
        isStretchy:!!safe(()=>n.isStretchy,false),
      });
    }

    const polyfills=[];
    if(this.showFills){
      const raw=safe(()=>this.fig.allPolyfills(),[]);
      for(const pf of raw){
        const anchor=finite(safe(()=>pf.anchorDrawIndex,-1),-1);
        if(anchor<0)continue;
        const flat=safe(()=>this.fig.getPolyfillVertices(anchor),null);
        if(!flat||flat.length<6)continue;

        polyfills.push({
          anchorDrawIndex:anchor,
          flat,
          color:hexToRgba(safe(()=>pf.colorHex,"#000000FF")),
          useColor:!!safe(()=>pf.usePolyfillColor,true),
        });
      }
    }

    this.sceneCache={scene,polyfills,figScale};
    return this.sceneCache;
  }

  _buildGPUScene(){
    this._disposeSceneMeshes();
    const {scene,polyfills}=this._extractScene();

    for(const s of scene){
      const meshData=nodeMesh(s);
      const mesh=new GLMesh(this.gl);
      mesh.upload(meshData.vertices,meshData.indices);
      this.sceneMeshes.push(mesh);
    }

    let figureColor=hexToRgba(safe(()=>this.fig.colorHex,"#202020FF"));
    for(const pf of polyfills){
      const meshData=newMesh();
      const flat=pf.flat;
      const c=pf.useColor?pf.color:figureColor;
      /*
       * WASM polyfill vertices are figure/world coordinates. Apply figure
       * scale once here, exactly like node geometry above.
       */
      for(let i=0;i+5<flat.length;i+=6){
        const base=meshData.vertices.length/6;
        for(let j=0;j<3;j++){
          const x=finite(flat[i+j*2])*this._extractScene().figScale;
          const y=finite(flat[i+j*2+1])*this._extractScene().figScale;
          meshData.vertices.push(x,y,...c);
        }
        meshData.indices.push(base,base+1,base+2);
      }
      const mesh=new GLMesh(this.gl);
      mesh.upload(meshData.vertices,meshData.indices);
      this.polyfillMeshes.push(mesh);
    }

    this.dirty=false;
  }

  /* ------------------------------------------------------------------------ *
   * Bounds — geometry-aware approximation following StickfigureSizeCalculator
   * ---------------------------------------------------------------------- */

  _bounds(){
    const {scene,polyfills}=this._extractScene();
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;

    const add=(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);
                      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};

    for(const s of scene){
      add(s.sx,s.sy);add(s.ex,s.ey);
      const r=Math.max(s.thickness*0.5,1);
      add(s.sx-r,s.sy-r);add(s.sx+r,s.sy+r);
      add(s.ex-r,s.ey-r);add(s.ex+r,s.ey+r);

      if(s.type===NODE.CIRCLE){
        const L=Math.hypot(s.ex-s.sx,s.ey-s.sy);
        const ro=(L+s.thickness)*0.5;
        add(s.ex-ro,s.ey-ro);add(s.ex+ro,s.ey+ro);
      }else if(s.type===NODE.FILLED_CIRCLE){
        const r=Math.max(s.len,s.thickness)*0.5;
        add(s.ex-r,s.ey-r);add(s.ex+r,s.ey+r);
      }else if(s.type===NODE.ELLIPSE){
        const rx=s.len*0.5,ry=s.thickness*0.5;
        const a=Math.atan2(s.ey-s.sy,s.ex-s.sx)-Math.PI/2;
        const ex=Math.sqrt(rx*rx*Math.cos(a)**2+ry*ry*Math.sin(a)**2);
        const ey=Math.sqrt(rx*rx*Math.sin(a)**2+ry*ry*Math.cos(a)**2);
        add(s.ex-ex,s.ey-ey);add(s.ex+ex,s.ey+ey);
      }else if(Math.abs(s.curveRadius)>0.5){
        const rr=Math.abs(s.curveRadius)+s.thickness*0.5;
        add(s.sx-rr,s.sy-rr);add(s.sx+rr,s.sy+rr);
        add(s.ex-rr,s.ey-rr);add(s.ex+rr,s.ey+rr);
      }
    }

    for(const pf of polyfills){
      for(let i=0;i+1<pf.flat.length;i+=2){
        add(finite(pf.flat[i])*this._extractScene().figScale,
            finite(pf.flat[i+1])*this._extractScene().figScale);
      }
    }

    if(!Number.isFinite(minX))return {minX:-50,minY:-50,maxX:50,maxY:50};
    return {minX,minY,maxX,maxY};
  }

  fitView(){
    this._ensureSize();
    const b=this._bounds();
    const pad=Math.max(12,Math.max(b.maxX-b.minX,b.maxY-b.minY)*0.08);
    const minX=b.minX-pad,minY=b.minY-pad,maxX=b.maxX+pad,maxY=b.maxY+pad;
    const spanX=Math.max(40,maxX-minX),spanY=Math.max(40,maxY-minY);
    const W=this.canvas.width,H=this.canvas.height;
    this.view.zoom=Math.min((W-40)/spanX,(H-40)/spanY);
    this.view.cx=(minX+maxX)/2;
    this.view.cy=(minY+maxY)/2;
    this.view.fitted=true;
  }

  resetView(){
    this.view={cx:0,cy:0,zoom:1,fitted:true};
    this.dirty=true;
  }

  zoomBy(factor,pivotX,pivotY){
    this._ensureSize();
    if(!Number.isFinite(pivotX)){pivotX=this.canvas.width/2;pivotY=this.canvas.height/2;}
    const oldZoom=this.view.zoom;
    const wx=(pivotX-this.canvas.width/2)/oldZoom+this.view.cx;
    const sy=this.flipY?-1:1;
    const wy=((pivotY-this.canvas.height/2)/oldZoom)*sy+this.view.cy;

    this.view.zoom=clamp(oldZoom*factor,0.001,1000);
    this.view.cx=wx-(pivotX-this.canvas.width/2)/this.view.zoom;
    this.view.cy=wy-(((pivotY-this.canvas.height/2)/this.view.zoom)*sy);
    this.dirty=true;
  }

  _screenToWorld(px,py){
    const sy=this.flipY?-1:1;
    return {
      x:(px-this.canvas.width/2)/this.view.zoom+this.view.cx,
      y:((py-this.canvas.height/2)/this.view.zoom)*sy+this.view.cy
    };
  }

  _eventPos(ev){
    const r=this.canvas.getBoundingClientRect();
    return {
      x:(ev.clientX-r.left)*(this.canvas.width/r.width),
      y:(ev.clientY-r.top)*(this.canvas.height/r.height)
    };
  }

  /* ------------------------------------------------------------------------ *
   * Rendering
   * ---------------------------------------------------------------------- */

  _setCamera(p){
    const gl=this.gl;
    gl.useProgram(p);
    const isOverlay=p===this.overlayProgram;
    gl.uniform2f(isOverlay?this.loc.ores:this.loc.res,this.canvas.width,this.canvas.height);
    gl.uniform2f(isOverlay?this.loc.ocam:this.loc.cam,this.view.cx,this.view.cy);
    gl.uniform1f(isOverlay?this.loc.ozoom:this.loc.zoom,this.view.zoom);
    gl.uniform1f(isOverlay?this.loc.oflip:this.loc.flip,this.flipY?-1:1);
  }

  _drawOverlay(){
    if(!this.showPoints||!this.fig)return;

    const {scene}=this._extractScene();
    const out=[];
    const selected=this.selectedIndex;

    /*
     * Real StickNodes separates node-marker rendering from figure geometry.
     * Regular body nodes are NOT automatically painted with circles.
     */
    for(const s of scene){
      const x=s.ex,y=s.ey;

      if(s.hasConnector){
        diamondMarker(out,x,y,Math.max(4,8/this.view.zoom),[0.95,0.25,0.55,1]);
      }

      if(s.isAngleLocked){
        overlayMarker(out,x,y,Math.max(4,7/this.view.zoom),[0.95,0.55,0.15,1]);
      }

      if(selected===s.drawIndex){
        overlayMarker(out,x,y,Math.max(5,8/this.view.zoom),[0.31,0.27,0.86,1]);
      }

      /*
       * Polyfill anchors have their own editor marker. The WASM method is
       * authoritative when available; otherwise compare anchor draw indices.
       */
      let isAnchor=false;
      try{isAnchor=!!this.fig.drawIndexIsPolyfillAnchor(s.drawIndex);}catch(_){
        isAnchor=safe(()=>this._extractScene().polyfills.some(p=>p.anchorDrawIndex===s.drawIndex),false);
      }
      if(isAnchor){
        overlayMarker(out,x,y,Math.max(5,9/this.view.zoom),[0.95,0.35,0.75,1]);
      }
    }

    if(!out.length)return;

    const gl=this.gl;
    gl.useProgram(this.overlayProgram);
    this._setCamera(this.overlayProgram);

    gl.bindVertexArray(this.overlayVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.overlayVBO);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,4,gl.FLOAT,false,24,8);

    gl.lineWidth(1);
    gl.drawArrays(gl.LINES,0,out.length/6);

    gl.bindVertexArray(null);
  }

  render(){
    if(!this.fig)return null;
    this._ensureSize();
    if(!this.view.fitted)this.fitView();
    if(this.dirty)this._buildGPUScene();

    const gl=this.gl;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    this._setCamera(this.program);

    /*
     * StickNodes draw order is node order, followed by polyfills/overlays in
     * their dedicated rendering passes. Keep that ordering here.
     */
    for(const m of this.sceneMeshes)m.draw();
    for(const m of this.polyfillMeshes)m.draw();

    this._drawOverlay();

    const cache=this._extractScene();
    return {
      zoom:this.view.zoom,
      nodeCount:cache.scene.length,
      fillCount:cache.polyfills.length
    };
  }

  /* ------------------------------------------------------------------------ *
   * Hit testing
   * ---------------------------------------------------------------------- */

  _hitNode(px,py){
    if(!this.fig)return null;
    const world=this._screenToWorld(px,py);
    const {scene}=this._extractScene();

    let best=null,bestScore=Infinity;

    /*
     * Prefer visible/editor-relevant handles. If no special handle is hit,
     * allow the normal endpoint hit target so a node can still be selected.
     */
    for(let i=scene.length-1;i>=0;i--){
      const s=scene[i];
      const d=Math.hypot(world.x-s.ex,world.y-s.ey);
      const special=s.hasConnector||s.isAngleLocked||s.drawIndex===this.selectedIndex;
      const tol=Math.max((special?18:14)/this.view.zoom,s.thickness*0.35);
      if(d<=tol&&d<bestScore){best=s.node;bestScore=d;}
    }
    return best;
  }

  /* ------------------------------------------------------------------------ *
   * Pointer interaction
   * ---------------------------------------------------------------------- */

  _down(ev){
    this._ensureSize();
    const p=this._eventPos(ev);
    this.pointers.set(ev.pointerId,p);
    try{this.canvas.setPointerCapture(ev.pointerId);}catch(_){}

    if(this.pointers.size===1){
      const hit=this._hitNode(p.x,p.y);

      if(hit&&this.dragEnabled){
        const start=safe(()=>hit.getGlobalStart(),[0,0]);
        const scale=finite(safe(()=>this.fig.scale,1),1)||1;

        /*
         * Do not reproduce StickNode.dragTo() in JS.  WASM owns the editing
         * calculation.  The fallback below exists only for older wrappers.
         */
        this.activeDrag={
          node:hit,
          scale,
          startWorld:[start[0]*scale,start[1]*scale],
          moved:false
        };
      }else{
        this.activePan={lastX:p.x,lastY:p.y,moved:false};
      }
      ev.preventDefault();
    }else if(this.pointers.size===2){
      const a=[...this.pointers.values()];
      const dx=a[0].x-a[1].x,dy=a[0].y-a[1].y;
      this.pinch={
        dist:Math.hypot(dx,dy)||1,
        zoom:this.view.zoom,
        cx:this.view.cx,cy:this.view.cy
      };
      this.activeDrag=null;
      this.activePan=null;
      ev.preventDefault();
    }
  }

  _move(ev){
    if(!this.pointers.has(ev.pointerId))return;
    const p=this._eventPos(ev);
    this.pointers.set(ev.pointerId,p);

    if(this.pointers.size===2&&this.pinch){
      const a=[...this.pointers.values()];
      const dx=a[0].x-a[1].x,dy=a[0].y-a[1].y;
      const d=Math.hypot(dx,dy)||1;
      const midX=(a[0].x+a[1].x)/2,midY=(a[0].y+a[1].y)/2;

      const nz=clamp(this.pinch.zoom*d/this.pinch.dist,0.001,1000);
      const sy=this.flipY?-1:1;
      const wx=(midX-this.canvas.width/2)/this.pinch.zoom+this.pinch.cx;
      const wy=((midY-this.canvas.height/2)/this.pinch.zoom)*sy+this.pinch.cy;

      this.view.zoom=nz;
      this.view.cx=wx-(midX-this.canvas.width/2)/nz;
      this.view.cy=wy-((midY-this.canvas.height/2)/nz)*sy;
      this.dirty=true;
      this.render();
      ev.preventDefault();
      return;
    }

    if(this.activeDrag&&this.fig){
      const world=this._screenToWorld(p.x,p.y);
      const node=this.activeDrag.node;
      let changed=false;

      try{
        if(typeof node.dragTo==="function"){
          /*
           * sticknodes-rs dragTo() expects figure-space coordinates.  The
           * renderer has one scale boundary, so undo figure scale here.
           */
          const scale=this.activeDrag.scale||1;
          node.dragTo(world.x/scale,world.y/scale);
          changed=true;
        }else{
          /* Compatibility fallback for an older wasm wrapper. */
          const start=this.activeDrag.startWorld;
          const dx=world.x-start[0],dy=world.y-start[1];
          const L=Math.hypot(dx,dy);
          if(L>0.01){
            const globalAngle=Math.atan2(dy,dx)/DEG;
            const pi=safe(()=>node.getParentIndex(),-1);
            let pa=0;
            if(pi>=0){
              const parent=safe(()=>this.fig.getNode(pi),null);
              pa=finite(safe(()=>parent?.getGlobalAngle(),0),0);
            }
            node.localAngle=globalAngle-pa;
            if(!!safe(()=>node.isStretchy,false)){
              const ss=!!safe(()=>node.useSegmentScale,false)
                ? finite(safe(()=>node.scale,1),1)||1 : 1;
              node.length=L/(this.activeDrag.scale*ss);
            }
            changed=true;
          }
        }
      }catch(_){changed=false;}

      if(changed){
        this.activeDrag.moved=true;
        this.sceneCache=null;
        this.dirty=true;
        this.render();
        if(this._onNodeChanged)this._onNodeChanged(node);
      }
      ev.preventDefault();
      return;
    }

    if(this.activePan){
      const sy=this.flipY?-1:1;
      const dx=p.x-this.activePan.lastX;
      const dy=p.y-this.activePan.lastY;
      this.view.cx-=dx/this.view.zoom;
      this.view.cy-=(dy/this.view.zoom)*sy;
      this.activePan.lastX=p.x;
      this.activePan.lastY=p.y;
      this.activePan.moved=true;
      this.dirty=true;
      this.render();
      ev.preventDefault();
    }
  }

  _up(ev){
    const p=this._eventPos(ev);
    const drag=this.activeDrag;
    const pan=this.activePan;

    this.pointers.delete(ev.pointerId);
    try{this.canvas.releasePointerCapture(ev.pointerId);}catch(_){}

    if(this.pointers.size<2)this.pinch=null;

    if(this.pointers.size===0){
      this.activeDrag=null;
      this.activePan=null;

      /*
       * Selection happens on a tap, not after a real drag/pan.
       */
      if(!(drag?.moved||pan?.moved)){
        const hit=this._hitNode(p.x,p.y);
        this.selectedIndex=hit?safe(()=>hit.drawIndex,null):null;
        if(this._onSelect)this._onSelect(hit||null);
        this.dirty=true;
        this.render();
      }
    }
  }

  _wheel(ev){
    ev.preventDefault();
    const p=this._eventPos(ev);
    this.zoomBy(ev.deltaY<0?1.15:1/1.15,p.x,p.y);
    this.render();
  }

  destroy(){
    this.canvas.removeEventListener("pointerdown",this._down);
    this.canvas.removeEventListener("pointermove",this._move);
    this.canvas.removeEventListener("pointerup",this._up);
    this.canvas.removeEventListener("pointercancel",this._up);
    this.canvas.removeEventListener("wheel",this._wheel);
    if(this._resizeObserver)this._resizeObserver.disconnect();

    this._disposeSceneMeshes();
    const gl=this.gl;
    gl.deleteVertexArray(this.overlayVAO);
    gl.deleteBuffer(this.overlayVBO);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.overlayProgram);
  }
}
