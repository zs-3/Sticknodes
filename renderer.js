/* ══════════════════════════════════════════════════════════════════════
   renderer.js — canvas port of StickNodes SNShapeRenderer + drawLimbAA
   Coordinates: world units, Y DOWN.
   Colors: internally {r,g,b,a} 0-255 for canvas.
   ══════════════════════════════════════════════════════════════════════ */

/* ───── Color helpers ───── */
function hexToRgba(s) {
  let h = String(s).replace(/^#/, '');
  if (h.length === 6) h += 'FF';
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16),
    a: parseInt(h.slice(6,8), 16),
  };
}
function css(c, mul=1) {
  return `rgba(${c.r},${c.g},${c.b},${Math.min(1,(c.a/255)*mul).toFixed(3)})`;
}
function aaParams(m) {
  return Math.max(2, Math.floor((m < 80 ? m/80 : 1) * 6));
}

/* ───── Primitives (no AA) ───── */
function drawSeg(ctx,x1,y1,x2,y2,th,col){
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(th,0.01);ctx.lineCap='butt';
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
function drawRSeg(ctx,x1,y1,x2,y2,th,col){
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(th,0.01);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
function drawCircle(ctx,cx,cy,r,col){
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,cy,Math.max(r,0.01),0,Math.PI*2);ctx.fill();
}
function drawRing(ctx,cx,cy,ro,ri,col){
  ctx.fillStyle=col;ctx.beginPath();
  ctx.arc(cx,cy,Math.max(ro,0.01),0,Math.PI*2,false);
  ctx.arc(cx,cy,Math.max(ri,0.01),0,Math.PI*2,true);
  ctx.fill('evenodd');
}
function drawEllipse(ctx,cx,cy,rx,ry,ang,col){
  ctx.fillStyle=col;ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(cx,cy,Math.max(rx,0.01),Math.max(ry,0.01),ang,0,Math.PI*2);
  else { ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);ctx.scale(rx/ry,1);ctx.arc(0,0,Math.max(ry,0.01),0,Math.PI*2);ctx.restore(); }
  ctx.fill();
}
function drawTri(ctx,x1,y1,x2,y2,x3,y3,col){
  ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);
  ctx.closePath();ctx.fill();
}
function drawPoly(ctx,cx,cy,r,n,ang,col){
  ctx.fillStyle=col;ctx.beginPath();
  for(let i=0;i<n;i++){const a=ang+(i/n)*Math.PI*2;
    const px=cx+r*Math.cos(a),py=cy+r*Math.sin(a);
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
  ctx.closePath();ctx.fill();
}
function drawTrap(ctx,x1,y1,x2,y2,w1,w2,ang,col){
  const nx=-Math.sin(ang),ny=Math.cos(ang);
  ctx.fillStyle=col;ctx.beginPath();
  ctx.moveTo(x1+nx*w1/2,y1+ny*w1/2);
  ctx.lineTo(x2+nx*w2/2,y2+ny*w2/2);
  ctx.lineTo(x2-nx*w2/2,y2-ny*w2/2);
  ctx.lineTo(x1-nx*w1/2,y1-ny*w1/2);
  ctx.closePath();ctx.fill();
}

/* ───── AA wrappers ───── */
function aSeg(ctx,x1,y1,x2,y2,th,col){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
  const ca=len>0.001?dx/len:1,sa=len>0.001?dy/len:0,N=aaParams(Math.max(th,len));
  ctx.globalAlpha=0.2;
  for(let i=1;i<=N;i++){const g=i*0.18666667,h=g/2;
    drawSeg(ctx,x1-ca*h,y1-sa*h,x2+ca*h,y2+sa*h,th+g,col);}
  ctx.globalAlpha=1;drawSeg(ctx,x1,y1,x2,y2,th,col);
}
function aRSeg(ctx,x1,y1,x2,y2,th,col){
  const len=Math.hypot(x2-x1,y2-y1),N=aaParams(Math.max(th,len));
  ctx.globalAlpha=0.2;
  for(let i=0;i<=N;i++) drawRSeg(ctx,x1,y1,x2,y2,th+i*0.14,col);
  ctx.globalAlpha=1;drawRSeg(ctx,x1,y1,x2,y2,th,col);
}
function aCircle(ctx,cx,cy,r,col){
  const g=r<40?r/40:1,N=Math.max(2,Math.floor(g*6));
  ctx.globalAlpha=0.2;
  for(let i=0;i<=N;i++) drawCircle(ctx,cx,cy,r+i*0.093333334,col);
  ctx.globalAlpha=1;drawCircle(ctx,cx,cy,r,col);
}
function aRing(ctx,cx,cy,ro,ri,col){
  const g=ro<40?ro/40:1,N=Math.max(2,Math.floor(g*6));
  ctx.globalAlpha=0.2;
  for(let i=0;i<=N;i++) drawRing(ctx,cx,cy,ro+i*0.093333334,ri+i*0.093333334,col);
  ctx.globalAlpha=1;drawRing(ctx,cx,cy,ro,ri,col);
}
function jitter(ctx,col,fn){
  for(let lv=1;lv<=5;lv++)
    for(let jx=-1;jx<=1;jx++)
      for(let jy=-1;jy<=1;jy++){
        if(!jx&&!jy)continue;
        ctx.globalAlpha=0.1;fn(jx,jy,lv);}
  ctx.globalAlpha=1;fn(0,0,1);
}
function aTri(ctx,x1,y1,x2,y2,x3,y3,th,col){
  const jb=0.28*Math.min(Math.abs(th)/12,1);
  jitter(ctx,col,(jx,jy,lv)=>{const ox=jx*0.5*jb*lv,oy=jy*0.5*jb*lv;
    drawTri(ctx,x1+ox,y1+oy,x2+ox,y2+oy,x3+ox,y3+oy,col);});
}
function aEllipse(ctx,cx,cy,rx,ry,ang,col){
  const jb=0.42*Math.min(Math.max(rx,ry)/128,1);
  jitter(ctx,col,(jx,jy,lv)=>{const ox=jx*0.5*jb*lv,oy=jy*0.5*jb*lv;
    drawEllipse(ctx,cx+ox,cy+oy,rx,ry,ang,col);});
}
function aTrap(ctx,x1,y1,x2,y2,w1,w2,ang,col){
  const jb=0.42*Math.min(Math.max(w1,w2)/80,1);
  jitter(ctx,col,(jx,jy,lv)=>{const ox=jx*0.5*jb*lv,oy=jy*0.5*jb*lv;
    drawTrap(ctx,x1+ox,y1+oy,x2+ox,y2+oy,w1,w2,ang,col);});
}
function aPoly(ctx,cx,cy,r,n,ang,col){
  const g=r<32?r/32:1,N=Math.max(2,Math.floor(g*6));
  ctx.globalAlpha=0.2;
  for(let i=0;i<=N;i++) drawPoly(ctx,cx,cy,r+i*0.23333333,n,ang,col);
  ctx.globalAlpha=1;drawPoly(ctx,cx,cy,r,n,ang,col);
}

/* ───── Curve subdivision ───── */
function subdivideCurve(ax,ay,bx,by,R){
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  if(len<0.5||Math.abs(R)<0.5)return[[ax,ay],[bx,by]];
  const half=len/2,Ra=Math.abs(R);
  if(Ra<half)return[[ax,ay],[bx,by]];
  const h=Ra-Math.sqrt(Ra*Ra-half*half);
  const mx=(ax+bx)/2,my=(ay+by)/2;
  const px=-dy/len,py=dx/len;
  const sign=R>0?1:-1;
  const cx=mx+px*h*sign,cy=my+py*h*sign;
  const a1=Math.atan2(ay-cy,ax-cx),a2=Math.atan2(by-cy,bx-cx);
  let da=a2-a1;
  if(sign>0){while(da<0)da+=Math.PI*2;}
  else{while(da>0)da-=Math.PI*2;}
  const n=Math.max(4,Math.min(32,Math.round(Math.abs(da)*4)));
  const pts=[];
  for(let i=0;i<=n;i++){const t=i/n,a=a1+da*t;
    pts.push([cx+Ra*Math.cos(a),cy+Ra*Math.sin(a)]);}
  return pts;
}
function aRSegCurved(ctx,sx,sy,ex,ey,th,R,col){
  const pts=subdivideCurve(sx,sy,ex,ey,R);
  for(let i=0;i<pts.length-1;i++)
    aRSeg(ctx,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],th,col);
}

/* ───── Polyfill ───── */
function aPolyfill(ctx,verts,col){
  if(verts.length<3)return;
  jitter(ctx,col,(jx,jy,lv)=>{
    const ox=jx*0.5*0.28*lv,oy=jy*0.5*0.28*lv;
    ctx.fillStyle=col;ctx.beginPath();
    ctx.moveTo(verts[0].x+ox,verts[0].y+oy);
    for(let i=1;i<verts.length;i++)ctx.lineTo(verts[i].x+ox,verts[i].y+oy);
    ctx.closePath();ctx.fill();
  });
}

/* ───── Node dispatch — equivalent of StickNode.drawLimbAA ───── */
function drawNode(ctx,s){
  const len=Math.hypot(s.ex-s.sx,s.ey-s.sy);
  const angle=Math.atan2(s.ey-s.sy,s.ex-s.sx);
  const col=css(s.color);
  switch(s.type){
    case 1:
      if(s.curveRadius) aRSegCurved(ctx,s.sx,s.sy,s.ex,s.ey,s.thickness,s.curveRadius,col);
      else aSeg(ctx,s.sx,s.sy,s.ex,s.ey,s.thickness,col);
      break;
    case 0:
      if(s.curveRadius) aRSegCurved(ctx,s.sx,s.sy,s.ex,s.ey,s.thickness,s.curveRadius,col);
      else aRSeg(ctx,s.sx,s.sy,s.ex,s.ey,s.thickness,col);
      break;
    case 2:{
      const oR=(len+s.thickness)/2;
      const iR=Math.max(0,oR-s.thickness);
      if(s.hollow) aRing(ctx,s.ex,s.ey,oR,iR,col);
      else aCircle(ctx,s.ex,s.ey,oR,col);
      break;
    }
    case 4:
      aCircle(ctx,s.ex,s.ey,Math.max(len,s.thickness)/2,col);
      break;
    case 3:{
      const r=Math.max(1,len);
      const base=angle+Math.PI,side=2*Math.PI/3;
      aTri(ctx,
        s.ex,s.ey,
        s.ex+r*Math.cos(base+side/2),s.ey+r*Math.sin(base+side/2),
        s.ex+r*Math.cos(base-side/2),s.ey+r*Math.sin(base-side/2),
        s.thickness,col);
      break;
    }
    case 5:
      aEllipse(ctx,s.ex,s.ey,Math.max(.5,len/2),Math.max(.5,s.thickness/2),angle,col);
      break;
    case 6:{
      const w1=s.trStart||s.thickness,w2=s.trEnd||s.thickness*0.5;
      aTrap(ctx,s.sx,s.sy,s.ex,s.ey,w1,w2,angle,col);
      break;
    }
    case 7:
      aPoly(ctx,s.ex,s.ey,Math.max(1,len),Math.max(3,s.numPoly),angle,col);
      break;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Scene extraction
   ══════════════════════════════════════════════════════════════════════ */
function extractScene(fig, showFills){
  const nodes=fig.allNodes();
  const scene=[];
  for(const n of nodes){
    if(n.nodeType===-1)continue;
    let s,e;
    try{s=n.getGlobalStart();e=n.getGlobalEnd();}catch(_){continue;}
    let hollow=false,trStart=0,trEnd=0,numPoly=5,curveRadius=0;
    try{hollow=n.circleIsHollow;}catch(_){}
    try{trStart=n.getTrapezoidThicknessStart();}catch(_){}
    try{trEnd=n.getTrapezoidThicknessEnd();}catch(_){}
    try{numPoly=n.numPolygonVertices;}catch(_){}
    try{curveRadius=n.segmentCurveRadiusAndDefaultCurveRadius;}catch(_){}
    scene.push({
      node:n,type:n.nodeType,drawIndex:n.drawIndex,
      sx:s[0],sy:s[1],ex:e[0],ey:e[1],
      thickness:Math.abs(n.getEffectiveThickness()||1),
      color:hexToRgba(n.getDisplayColorHex()),
      hollow,trStart,trEnd,numPoly,curveRadius,
    });
  }
  const polyfills=[];
  if(showFills){
    try{
      const raw=fig.allPolyfills();
      for(const pf of raw){
        try{
          const flat=fig.getPolyfillVertices(pf.anchorDrawIndex);
          const verts=[];
          for(let i=0;i+1<flat.length;i+=2)verts.push({x:flat[i],y:flat[i+1]});
          if(verts.length>=3)polyfills.push({
            verts,color:hexToRgba(pf.colorHex),useColor:pf.usePolyfillColor});
        }catch(_){}
      }
    }catch(_){}
  }
  return{scene,polyfills};
}

/* ══════════════════════════════════════════════════════════════════════
   Renderer class
   ══════════════════════════════════════════════════════════════════════ */
export class StickNodesRenderer {
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.fig=null;
    this.showFills=true;
    this.dragEnabled=true;
    this.view={fit:1,cx:0,cy:0,W:0,H:0};
    this.drag=null;
    this._changeCb=null;

    this._onDown=this._onDown.bind(this);
    this._onMove=this._onMove.bind(this);
    this._onUp=this._onUp.bind(this);
    canvas.addEventListener('pointerdown',this._onDown);
    canvas.addEventListener('pointermove',this._onMove);
    canvas.addEventListener('pointerup',this._onUp);
    canvas.addEventListener('pointercancel',this._onUp);
  }

  setFigure(fig){this.fig=fig;}
  setFills(v){this.showFills=v;}
  setDragEnabled(v){this.dragEnabled=v;}
  onNodeChanged(fn){this._changeCb=fn;}

  render(){
    const fig=this.fig;
    if(!fig)return;
    const dpr=window.devicePixelRatio||1;
    const wrap=this.canvas.parentElement;
    const w=wrap.clientWidth,h=wrap.clientHeight;
    this.canvas.width=Math.floor(w*dpr);
    this.canvas.height=Math.floor(h*dpr);
    this.canvas.style.width=w+'px';
    this.canvas.style.height=h+'px';

    const ctx=this.ctx;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.globalAlpha=1;

    const{scene,polyfills}=extractScene(fig,this.showFills);

    // bbox
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,maxPad=0;
    for(const n of scene){
      const pad=Math.max(n.thickness,Math.hypot(n.ex-n.sx,n.ey-n.sy))/2;
      if(pad>maxPad)maxPad=pad;
      for(const p of[[n.sx,n.sy],[n.ex,n.ey]]){
        if(p[0]<minX)minX=p[0];if(p[1]<minY)minY=p[1];
        if(p[0]>maxX)maxX=p[0];if(p[1]>maxY)maxY=p[1];
      }
    }
    for(const pf of polyfills)for(const v of pf.verts){
      if(v.x<minX)minX=v.x;if(v.y<minY)minY=v.y;
      if(v.x>maxX)maxX=v.x;if(v.y>maxY)maxY=v.y;
    }
    if(!isFinite(minX)){minX=minY=-50;maxX=maxY=50;}
    const pad=maxPad+8;
    minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
    const spanX=Math.max(maxX-minX,40),spanY=Math.max(maxY-minY,40);
    const fit=Math.min((this.canvas.width-40)/spanX,(this.canvas.height-40)/spanY);
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    this.view={fit,cx,cy,W:this.canvas.width,H:this.canvas.height};

    ctx.save();
    ctx.translate(this.canvas.width/2,this.canvas.height/2);
    ctx.scale(fit,fit);
    ctx.translate(-cx,-cy);

    for(const n of scene) drawNode(ctx,n);

    let figCol={r:32,g:32,b:32,a:255};
    try{figCol=hexToRgba(fig.colorHex);}catch(_){}
    for(const pf of polyfills){
      const col=pf.useColor?pf.color:figCol;
      aPolyfill(ctx,pf.verts,css(col));
    }

    ctx.restore();
    ctx.globalAlpha=1;
    return{fit,nodeCount:scene.length,fillCount:polyfills.length};
  }

  /* ─── Pointer events ─── */
  _screenToWorld(ev){
    const r=this.canvas.getBoundingClientRect();
    const sx=(ev.clientX-r.left)*(this.canvas.width/r.width);
    const sy=(ev.clientY-r.top)*(this.canvas.height/r.height);
    const wx=(sx-this.view.W/2)/this.view.fit+this.view.cx;
    const wy=(sy-this.view.H/2)/this.view.fit+this.view.cy;
    return{x:wx,y:wy};
  }

  _onDown(ev){
    if(!this.dragEnabled||!this.fig)return;
    const world=this._screenToWorld(ev);
    const nodes=this.fig.allNodes();
    let best=null,bestDist=Infinity;
    for(const n of nodes){
      if(n.nodeType===-1)continue;
      const end=n.getGlobalEnd();
      const d=Math.hypot(world.x-end[0],world.y-end[1]);
      const tol=Math.max(20/this.view.fit,(Math.abs(n.getEffectiveThickness())||1)*0.75);
      if(d<tol&&d<bestDist){best=n;bestDist=d;}
    }
    if(best){
      const parentIdx=best.getParentIndex();
      let pivot,parentAngle=0;
      try{pivot=best.getGlobalStart();}catch(_){pivot=null;}
      if(parentIdx!==undefined&&parentIdx!==null&&parentIdx>=0){
        try{
          const parent=this.fig.getNode(parentIdx);
          parentAngle=parent.getGlobalAngle();
        }catch(_){}
      }
      if(pivot){
        this.drag={node:best,pivot,parentAngle};
        this.canvas.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      }
    }
  }

  _onMove(ev){
    if(!this.drag||!this.fig)return;
    const world=this._screenToWorld(ev);
    const node=this.drag.node;
    const dx=world.x-this.drag.pivot[0];
    const dy=world.y-this.drag.pivot[1];
    const len=Math.hypot(dx,dy);
    if(len<1)return;
    const globalAngleDeg=Math.atan2(dy,dx)*180/Math.PI;
    const figScale=this.fig.scale||1;
    const segScale=node.useSegmentScale?(node.scale||1):1;
    try{
      node.localAngle=globalAngleDeg-this.drag.parentAngle;
      node.length=len/figScale/segScale;
    }catch(e){return;}
    this.render();
    if(this._changeCb)this._changeCb(node);
  }

  _onUp(ev){
    if(this.drag){
      try{this.canvas.releasePointerCapture(ev.pointerId);}catch(_){}
      this.drag=null;
    }
  }

  destroy(){
    this.canvas.removeEventListener('pointerdown',this._onDown);
    this.canvas.removeEventListener('pointermove',this._onMove);
    this.canvas.removeEventListener('pointerup',this._onUp);
    this.canvas.removeEventListener('pointercancel',this._onUp);
  }
}
