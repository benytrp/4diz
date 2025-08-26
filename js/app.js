
// --- Console guard & error surfacing ---
window.addEventListener('error', (e) => { console.error('[4D Studio Error]', e.message, e.error); });
console.log('[4D Studio] booting…');

// ===== Utilities =====
function mulberry32(seed){ let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function textEncoderBytes(str){ return new TextEncoder().encode(str); }
function sortKeys(obj){ if (obj === null || typeof obj !== 'object') return obj; if (Array.isArray(obj)) return obj.map(sortKeys); const out={}; Object.keys(obj).sort().forEach(k=>out[k]=sortKeys(obj[k])); return out; }
function stableStringify(obj){ return JSON.stringify(sortKeys(obj)); }
async function sha256Hex(str){ const buf = await crypto.subtle.digest('SHA-256', textEncoderBytes(str)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

// ===== Projection System =====
const projParams = {
  d:{value:8,min:2,max:24,step:0.5},
  a:{value:0.2,min:-1,max:1,step:0.01},
  b:{value:0.2,min:-1,max:1,step:0.01},
  R:{value:12,min:2,max:24,step:0.5},
  c:{value:8,min:-12,max:24,step:0.5}
};

const projectionPresets = {
  "flat-slice": { name:"Flat Slice", mode:"slice", params:{d:8,a:0,b:0,R:12,c:8} },
  "deep-perspective": { name:"Deep Perspective", mode:"perspective", params:{d:4,a:0.2,b:0.2,R:12,c:8} },
  "w-parallax": { name:"W-Parallax", mode:"orthogonal", params:{d:8,a:0.6,b:0.4,R:12,c:8} },
  "hyperbolic-compress": { name:"Hyperbolic Compress", mode:"stereographic", params:{d:8,a:0.2,b:0.2,R:6,c:4} },
  "extreme-perspective": { name:"Extreme Perspective", mode:"perspective", params:{d:1.5,a:0.2,b:0.2,R:12,c:8} }
};

const Proj = {
  slice: ({x,y,z}) => ({x,y,z}),
  perspective: ({x,y,z,w}, wSlice, p=projParams) => { const s=p.d.value/(p.d.value + (w - wSlice)); return {x:x*s,y:y*s,z:z*s}; },
  orthogonal: ({x,y,z,w}, wSlice, p=projParams) => ({ x:x + p.a.value*w, y, z:z + p.b.value*w }),
  stereographic: ({x,y,z,w}, wSlice, p=projParams) => { const wo=(w - wSlice)+p.c.value; const s=p.R.value/(wo + p.R.value); return {x:x*s, y:y*s, z:z*s}; }
};

function validateParams(){
  const warnings={}, dangers={};
  if (projParams.d.value < 0.5) dangers.d = "projection unstable at d < 0.5";
  else if (projParams.d.value < 1.5) warnings.d = "perspective may be extreme";
  if (Math.abs(projParams.a.value) > 1.5) warnings.a = "high w-blend may distort";
  if (Math.abs(projParams.b.value) > 1.5) warnings.b = "high w-blend may distort";
  if (projParams.R.value < 1) dangers.R = "stereographic radius too small";
  if (projParams.c.value < -10) warnings.c = "large negative offset";
  return {warnings, dangers};
}

// ===== 4D Data Structures =====
class Consciousness4DNode{
  constructor(position4D, type, properties){
    this.id = Math.random().toString(36).substring(2);
    this.position4D = position4D;
    this.type = type;
    this.properties = { intensity:1.0, coherence:0.7, kernelCoupling:1.0, age:0, ...properties };
    this.connections = new Set();
    this.flowState = { momentum: [0,0,0,0], energy: 1.0 };
  }
  project3D(projectionMode, wSlice){ const {x,y,z,w} = this.position4D; const fn = Proj[projectionMode] || Proj.slice; return fn({x,y,z,w}, wSlice); }
  isVisibleAtSlice(wSlice, tol=2.0){ return Math.abs(this.position4D.w - wSlice) <= tol; }
}

class Hyperstroke4D{
  constructor(type, consciousnessType){
    this.id = Math.random().toString(36).slice(2);
    this.type = type;
    this.consciousnessType = consciousnessType;
    this.points4D = [];
    this.properties = { size:2.0, intensity:1.0, coherence:0.7, kernelCoupling:1.0 };
  }
  addPoint4D(position4D, properties){ this.points4D.push({ position4D, properties }); }
}

class Consciousness4DStore{
  constructor(){
    this.hyperNodes = [];
    this.hyperStrokes = [];
    this.cursor4D = {x:0,y:0,z:0,w:0};
    this.wSlice = 0.0;
    this.projectionMode = 'slice';
    this.stats = { totalNodes:0, activeNodes:0, convergencePoints:0, kernelState:0, hyperStrokeCount:0 };
  }
  addHyperNode(p4, type, properties){ const node = new Consciousness4DNode(p4, type, properties); this.hyperNodes.push(node); this.updateStats(); return node; }
  addHyperStroke(stroke){ this.hyperStrokes.push(stroke); this.updateStats(); }
  getNodesAtSlice(w, tol=2.0){ return this.hyperNodes.filter(n => n.isVisibleAtSlice(w,tol)); }
  distance4D(a,b){ const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z, dw=a.w-b.w; return Math.hypot(dx,dy,dz,dw); }
  updateStats(){
    this.stats.totalNodes = this.hyperNodes.length;
    this.stats.hyperStrokeCount = this.hyperStrokes.length;
    this.stats.activeNodes = this.getNodesAtSlice(this.wSlice).length;
    let ksum=0; for(const n of this.hyperNodes) ksum += (n.properties.kernelCoupling||0);
    this.stats.kernelState = this.stats.totalNodes ? (ksum/this.stats.totalNodes) : 0;
  }
  toJSON(){ return { nodes:this.hyperNodes.map(n=>({id:n.id, position4D:n.position4D, type:n.type, properties:n.properties})), strokes:this.hyperStrokes, stats:this.stats, projection:this.projectionMode, w_slice:this.wSlice }; }
}

// ===== HUD =====
class Hud{
  constructor(canvas){ this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.last=performance.now(); this.fps=60; this.smoothed=60; this.resize(); }
  resize(){ this.canvas.width = this.canvas.clientWidth * devicePixelRatio; this.canvas.height = this.canvas.clientHeight * devicePixelRatio; }
  tick(){ const now=performance.now(); const dt=now-this.last; this.last=now; this.fps=1000/dt; this.smoothed = this.smoothed*0.9 + this.fps*0.1; }
  draw(data){
    const {nodes, strokes} = data; const ctx=this.ctx; const w=this.canvas.width, h=this.canvas.height;
    ctx.clearRect(0,0,w,h); ctx.save(); ctx.scale(devicePixelRatio, devicePixelRatio);
    const pad=12; const panelW=280; const panelH=60;
    ctx.globalAlpha=0.85; ctx.fillStyle='rgba(15,22,40,0.85)'; ctx.fillRect(pad, pad, panelW, panelH);
    ctx.globalAlpha=1; ctx.strokeStyle='rgba(41,50,74,1)'; ctx.lineWidth=1; ctx.strokeRect(pad+0.5, pad+0.5, panelW-1, panelH-1);
    ctx.fillStyle='#e7eaf0'; ctx.font='12px system-ui,Segoe UI,Roboto';
    ctx.fillText(`FPS: ${this.smoothed.toFixed(1)}`, pad+12, pad+20);
    ctx.fillText(`Nodes: ${nodes}`, pad+12, pad+38);
    ctx.fillText(`Strokes: ${strokes}`, pad+100, pad+38);
    ctx.restore();
  }
}

// ===== Main Studio =====
class Consciousness4DPaintStudio{
  constructor(){
    this.container = document.getElementById('canvas4d').parentElement;
    this.consciousness4D = new Consciousness4DStore();
    this.painting=false; this.currentHyperStroke=null;
    this.params = { tool:'4DBrush', consciousnessType:'ai', size:2.0, intensity:1.0, coherence:0.7, kernelCoupling:1.0 };
    this.maxInstances = 20000;
    this.activeInstances=0;
    this.activeInstanceCount={human:0, ai:0, hybrid:0, kernel:0};
    this.paintPlane = { normal: new THREE.Vector3(0, 1, 0), constant: 0 };
    this.init3D();
    this.setup4DUI();
    this.setupEventListeners();
    this.setupProjectionControls();
    this.setupProjectionPresets();
    this.animate();
    this.loadSample4DData();
  }

  init3D(){
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.Fog(0x0a0d14, 10, 100);

    const cw = Math.max(1, this.container.clientWidth);
    const ch = Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(75, cw / ch, 0.1, 1000);
    this.camera.position.set(8,8,12);
    this.target = new THREE.Vector3(0,0,0);

    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas4d'), antialias:true, preserveDrawingBuffer:true });
    this.renderer.setSize(cw, ch);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;

    this.hud = new Hud(document.getElementById('hud'));

    // Lights
    this.scene.add(new THREE.AmbientLight(0x404040, 0.6));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10,12,8);
    mainLight.castShadow=true;
    this.scene.add(mainLight);
    const humanLight = new THREE.PointLight(0xec4899, 0.3, 20); humanLight.position.set(-5,3,5); this.scene.add(humanLight);
    const aiLight = new THREE.PointLight(0x10b981, 0.3, 20); aiLight.position.set(5,3,5); this.scene.add(aiLight);
    const kernelLight = new THREE.PointLight(0xf59e0b, 0.4, 15); kernelLight.position.set(0,8,0); this.scene.add(kernelLight);

    this.create4DGrid();
    this.setup4DInstancedGeometry();
    this.setupCameraControls();
    console.log('[4D Studio] Three.js scene ready');
  }

  create4DGrid(){
    const grid = new THREE.GridHelper(20,20,0x444444,0x222222);
    this.scene.add(grid);
    const geo = new THREE.BufferGeometry(); const pos=[];
    for(let i=-5;i<=5;i+=2){ for(let j=-5;j<=5;j+=2){ pos.push(i,-1,j, i,6,j); } }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    const mat = new THREE.LineBasicMaterial({color:0x666666, opacity:0.3, transparent:true});
    this.scene.add(new THREE.LineSegments(geo,mat));
  }

  setup4DInstancedGeometry(){
    const gSphere=new THREE.SphereGeometry(0.1,16,12);
    const gOct=new THREE.OctahedronGeometry(0.12);
    const gTet=new THREE.TetrahedronGeometry(0.15);
    const mHuman=new THREE.MeshLambertMaterial({color:0xec4899,transparent:true,opacity:0.8});
    const mAI=new THREE.MeshLambertMaterial({color:0x10b981,transparent:true,opacity:0.8});
    const mHybrid=new THREE.MeshLambertMaterial({color:0x8b5cf6,transparent:true,opacity:0.8});
    const mKernel=new THREE.MeshLambertMaterial({color:0xf59e0b,transparent:true,opacity:0.9});
    this.instancedMeshes={
      human:new THREE.InstancedMesh(gSphere,mHuman,this.maxInstances/4),
      ai:new THREE.InstancedMesh(gOct,mAI,this.maxInstances/4),
      hybrid:new THREE.InstancedMesh(gTet,mHybrid,this.maxInstances/4),
      kernel:new THREE.InstancedMesh(gSphere,mKernel,this.maxInstances/4)
    };
    const hide=new THREE.Matrix4().makeScale(0,0,0);
    Object.values(this.instancedMeshes).forEach(mesh=>{
      for(let i=0;i<mesh.count;i++){ mesh.setMatrixAt(i,hide); }
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
    });
  }

  setupCameraControls(){
    this.isOrbiting=false; this.isPanning=false; this.lastPointerPos={x:0,y:0};
    this.raycaster=new THREE.Raycaster(); this.mouse=new THREE.Vector2(); this.intersectionPoint=new THREE.Vector3();
  }

  setup4DUI(){
    ['x','y','z','w'].forEach(axis=>{
      const s=document.getElementById(axis+'Axis'); const vd=document.getElementById(axis+'-value');
      s.addEventListener('input',e=>{
        const v=parseFloat(e.target.value); vd.textContent=v.toFixed(1); this.consciousness4D.cursor4D[axis]=v;
        if(axis==='w'){ this.consciousness4D.wSlice=v; document.getElementById('currentW').textContent=v.toFixed(1); this.update3DProjections(); }
      });
    });

    // Tools
    document.getElementById('tool4DBrush').addEventListener('click',()=>this.setTool('4DBrush'));
    document.getElementById('tool4DNode').addEventListener('click',()=>this.setTool('4DNode'));
    document.getElementById('tool4DFlow').addEventListener('click',()=>this.setTool('4DFlow'));
    document.getElementById('tool4DKernel').addEventListener('click',()=>this.setTool('4DKernel'));
    document.getElementById('tool4DEraser').addEventListener('click',()=>this.setTool('4DEraser'));

    // Types
    document.getElementById('typeHuman').addEventListener('click',()=>this.setConsciousnessType('human'));
    document.getElementById('typeAI').addEventListener('click',()=>this.setConsciousnessType('ai'));
    document.getElementById('typeHybrid').addEventListener('click',()=>this.setConsciousnessType('hybrid'));
    document.getElementById('typeKernel').addEventListener('click',()=>this.setConsciousnessType('kernel'));

    // Params
    ['brush4DSize','consciousnessIntensity','temporalCoherence','kernelCoupling'].forEach(id=>{
      const s=document.getElementById(id); const vd=document.getElementById(id+'-value');
      s.addEventListener('input',e=>{
        const v=parseFloat(e.target.value); vd.textContent=(id==='brush4DSize'?v.toFixed(1):v.toFixed(2));
        if(id==='brush4DSize') this.params.size=v;
        if(id==='consciousnessIntensity') this.params.intensity=v;
        if(id==='temporalCoherence') this.params.coherence=v;
        if(id==='kernelCoupling') this.params.kernelCoupling=v;
      });
    });

    document.getElementById('projectionMode').addEventListener('change',e=>{
      this.consciousness4D.projectionMode=e.target.value; this.update3DProjections(); this.refreshProjUI();
    });

    // Data ops
    document.getElementById('export4D').addEventListener('click',()=>this.export4DData());
    document.getElementById('import4D').addEventListener('click',()=>this.import4DData());
    document.getElementById('clear4D').addEventListener('click',()=>this.clear4DSpace());
    document.getElementById('sample4D').addEventListener('click',()=>this.loadSample4DData());
  }

  setupProjectionControls(){
    const sliders=['d','a','b','R','c'];
    sliders.forEach(key=>{
      const slider=document.getElementById(`p_${key}`); if(!slider) return;
      const param=projParams[key];
      slider.min=param.min; slider.max=param.max; slider.step=param.step; slider.value=param.value;
      slider.addEventListener('input',e=>{ param.value=parseFloat(e.target.value); this.applyValidationStyles(); this.update3DProjections(); });
    });
    this.applyValidationStyles();
  }

  setupProjectionPresets(){
    const select=document.getElementById('projPresets'); if(!select) return;
    Object.entries(projectionPresets).forEach(([key,preset])=>{ const option=document.createElement('option'); option.value=key; option.textContent=preset.name; select.appendChild(option); });
    select.addEventListener('change',(e)=>{
      const preset=projectionPresets[e.target.value]; if(!preset) return;
      this.consciousness4D.projectionMode = preset.mode;
      document.getElementById('projectionMode').value = preset.mode;
      Object.entries(preset.params).forEach(([k,v])=>{ if(projParams[k]){ projParams[k].value=v; const slider=document.getElementById(`p_${k}`); if(slider){ slider.value=Math.max(slider.min,Math.min(slider.max,v)); } } });
      this.applyValidationStyles(); this.update3DProjections(); this.refreshProjUI();
      setTimeout(()=>{ select.value=''; }, 100);
    });
  }

  applyValidationStyles(){
    const {warnings, dangers} = validateParams(); const sliders=['d','a','b','R','c'];
    sliders.forEach(key=>{ const slider=document.getElementById(`p_${key}`); if(!slider) return;
      slider.classList.remove('warn','danger'); slider.title='';
      if (dangers[key]) { slider.classList.add('danger'); slider.title=dangers[key]; }
      else if (warnings[key]) { slider.classList.add('warn'); slider.title=warnings[key]; }
    });
  }

  refreshProjUI(){
    const modeToKeys={ slice:[], perspective:['p_d'], orthogonal:['p_a','p_b'], stereographic:['p_R','p_c'] };
    const all=['p_d','p_a','p_b','p_R','p_c']; const keys=modeToKeys[this.consciousness4D.projectionMode] || [];
    all.forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.disabled = !keys.includes(id); el.style.opacity = el.disabled ? 0.4 : 1; });
  }

  setupEventListeners(){
    const c=this.renderer.domElement;
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>this.onPointerDown(e));
    c.addEventListener('pointermove',e=>this.onPointerMove(e));
    c.addEventListener('pointerup',e=>this.onPointerUp(e));
    c.addEventListener('wheel',e=>this.onWheel(e),{passive:false});
    window.addEventListener('resize',()=>this.onResize());
  }

  get4DPosition(clientX,clientY){
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.mouse.x=((clientX-rect.left)/rect.width)*2-1;
    this.mouse.y=-((clientY-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.mouse,this.camera);
    const plane = new THREE.Plane(this.paintPlane.normal, this.paintPlane.constant);
    const hit = new THREE.Vector3();
    const refDist = this.camera.position.distanceTo(this.target) * 0.7;
    const maxReasonableDistance = refDist * 2;
    const ok = this.raycaster.ray.intersectPlane(plane, hit);
    if (!ok) { this.raycaster.ray.at(refDist, hit); }
    else if (this.camera.position.distanceTo(hit) > maxReasonableDistance) { this.raycaster.ray.at(refDist, hit); }
    return { x: hit.x, y: hit.y, z: hit.z, w: this.consciousness4D.wSlice };
  }

  async start4DPaint(x,y){
    this.painting=true;
    const p4=this.get4DPosition(x,y);
    this.currentHyperStroke=new Hyperstroke4D(this.params.tool, this.params.consciousnessType);
    this.currentHyperStroke.addPoint4D(p4,{...this.params});
    this.add4DInstance(p4,this.params.consciousnessType);
    this.setBadge('PAINTING 4D');
  }

  async continue4DPaint(x,y){
    if(!this.painting||!this.currentHyperStroke) return;
    const p4=this.get4DPosition(x,y);
    const last=this.currentHyperStroke.points4D[this.currentHyperStroke.points4D.length-1];
    const d=this.consciousness4D.distance4D(p4,last.position4D);
    if(d>0.2){
      this.currentHyperStroke.addPoint4D(p4,{...this.params});
      const steps=Math.ceil(d/0.1);
      for(let i=1;i<=steps;i++){
        const t=i/steps;
        const ip={
          x:last.position4D.x+(p4.x-last.position4D.x)*t,
          y:last.position4D.y+(p4.y-last.position4D.y)*t,
          z:last.position4D.z+(p4.z-last.position4D.z)*t,
          w:last.position4D.w+(p4.w-last.position4D.w)*t
        };
        this.add4DInstance(ip,this.params.consciousnessType);
      }
    }
  }

  async end4DPaint(){
    if(!this.painting) return;
    this.painting=false;
    if(this.currentHyperStroke){
      this.consciousness4D.addHyperStroke(this.currentHyperStroke);
      this.currentHyperStroke=null;
      this.updateUI();
    }
    this.setBadge('HYPERSPACE READY');
  }

  add4DInstance(position4D, type){
    const mesh=this.instancedMeshes[type];
    const idx=this.activeInstanceCount[type];
    if(idx>=mesh.count) return;
    const p3=this.project4DTo3D(position4D);
    const m=new THREE.Matrix4();
    const s=this.params.size*0.1;
    m.compose(new THREE.Vector3(p3.x,p3.y,p3.z), new THREE.Quaternion(), new THREE.Vector3(s,s,s));
    mesh.setMatrixAt(idx,m);
    this.activeInstanceCount[type]++;
    mesh.instanceMatrix.needsUpdate=true;
    this.consciousness4D.addHyperNode(position4D,type,{
      intensity:this.params.intensity, coherence:this.params.coherence, kernelCoupling:this.params.kernelCoupling
    });
    this.activeInstances++;
  }

  project4DTo3D(p4){ const fn = Proj[this.consciousness4D.projectionMode] || Proj.slice; return fn(p4, this.consciousness4D.wSlice); }

  update3DProjections(){
    const nodes = this.consciousness4D.hyperNodes;
    if (nodes.length > 5000) this.updateProjectionsInBatches(nodes);
    else this.updateProjectionsImmediate();
  }

  updateProjectionsImmediate(){
    Object.keys(this.instancedMeshes).forEach(type=>{
      const mesh=this.instancedMeshes[type]; let visible=0;
      const hide=new THREE.Matrix4().makeScale(0,0,0);
      this.consciousness4D.hyperNodes.forEach(node=>{
        if(node.type!==type) return;
        const proj=node.project3D(this.consciousness4D.projectionMode,this.consciousness4D.wSlice);
        if(node.isVisibleAtSlice(this.consciousness4D.wSlice,2.0)){
          const m=new THREE.Matrix4();
          const sc=(node.properties.intensity||1)*0.1;
          m.compose(new THREE.Vector3(proj.x,proj.y,proj.z), new THREE.Quaternion(), new THREE.Vector3(sc,sc,sc));
          mesh.setMatrixAt(visible,m);
          visible++;
        }
      });
      for(let i=visible;i<mesh.count;i++) mesh.setMatrixAt(i,hide);
      mesh.instanceMatrix.needsUpdate=true;
      this.activeInstanceCount[type]=visible;
    });
    this.consciousness4D.updateStats();
    this.updateUI();
  }

  updateProjectionsInBatches(nodes, startIdx=0){
    const BATCH_SIZE=500; const endIdx=Math.min(startIdx+BATCH_SIZE, nodes.length);
    Object.keys(this.instancedMeshes).forEach(type=>{
      const mesh=this.instancedMeshes[type]; const hide=new THREE.Matrix4().makeScale(0,0,0);
      let visible = startIdx===0 ? 0 : this.activeInstanceCount[type];
      for(let i=startIdx;i<endIdx;i++){
        const node=nodes[i]; if(node.type!==type) continue;
        const proj = node.project3D(this.consciousness4D.projectionMode, this.consciousness4D.wSlice);
        if(node.isVisibleAtSlice(this.consciousness4D.wSlice,2.0)){
          const m=new THREE.Matrix4(); const sc=(node.properties.intensity||1)*0.1;
          m.compose(new THREE.Vector3(proj.x,proj.y,proj.z), new THREE.Quaternion(), new THREE.Vector3(sc,sc,sc));
          if(visible < mesh.count){ mesh.setMatrixAt(visible,m); visible++; }
        }
      }
      if (endIdx >= nodes.length){ for(let i=visible;i<mesh.count;i++) mesh.setMatrixAt(i,hide); }
      mesh.instanceMatrix.needsUpdate = true; this.activeInstanceCount[type]=visible;
    });
    if (endIdx < nodes.length) requestAnimationFrame(()=>this.updateProjectionsInBatches(nodes, endIdx));
    else { this.consciousness4D.updateStats(); this.updateUI(); }
  }

  async loadSample4DData(){
    this.clear4DSpace();
    const rng=mulberry32(123456789);
    const human=[{x:-3,y:2,z:1,w:-1.5},{x:-2,y:1.5,z:0.5,w:0},{x:-1.5,y:2.5,z:-0.5,w:1.2},{x:-2.8,y:0.8,z:1.2,w:-0.8}];
    const ai=[{x:3,y:1,z:0,w:0},{x:2.5,y:2,z:1,w:0.8},{x:3.5,y:0.5,z:-1,w:0.8},{x:2.8,y:1.8,z:0.3,w:-0.5},{x:3.2,y:0.2,z:0.7,w:1.5}];
    const hybrid=[{x:0,y:3,z:0,w:0.5},{x:-0.5,y:-1,z:2,w:-1},{x:0.8,y:0,z:-1.5,w:2}];
    const kernel=[{x:0,y:0,z:0,w:0},{x:0.3,y:0.3,z:0.3,w:1.8},{x:-0.2,y:-0.1,z:0.4,w:-2.2}];
    const add=(arr,type,baseInt)=>{ arr.forEach(pos=>{
      this.consciousness4D.addHyperNode(pos,type,{
        intensity: baseInt + rng()*0.4,
        coherence: 0.6 + rng()*0.3,
        kernelCoupling: (type==='kernel'? 3.0 : (type==='ai'? 1.5 : 0.8)) + rng()*0.5
      });
    }); };
    add(human,'human',0.8); add(ai,'ai',1.2); add(hybrid,'hybrid',1.0); add(kernel,'kernel',1.8);
    this.update3DProjections();
    this.setBadge('SAMPLE LOADED'); setTimeout(()=>this.setBadge('HYPERSPACE READY'), 1200);
  }

  onPointerDown(e){
    e.preventDefault();
    this.lastPointerPos={x:e.clientX,y:e.clientY};
    if(e.button===2){ this.isOrbiting=true; }
    else if(e.button===1){ this.isPanning=true; }
    else if(e.button===0){ this.start4DPaint(e.clientX,e.clientY); }
  }

  onPointerMove(e){
    const dx=e.clientX-this.lastPointerPos.x, dy=e.clientY-this.lastPointerPos.y;
    if(this.isOrbiting){
      const off=this.camera.position.clone().sub(this.target);
      const sph=new THREE.Spherical().setFromVector3(off);
      sph.theta -= dx*0.01; sph.phi += dy*0.01;
      sph.phi=Math.max(0.1, Math.min(Math.PI-0.1, sph.phi));
      off.setFromSpherical(sph);
      this.camera.position.copy(this.target).add(off);
      this.camera.lookAt(this.target);
    } else if(this.isPanning){
      const sp=0.002*this.camera.position.distanceTo(this.target);
      const right=new THREE.Vector3().subVectors(this.camera.position,this.target).cross(this.camera.up).normalize();
      const up=this.camera.up.clone();
      const pan= right.multiplyScalar(-dx*sp).add(up.multiplyScalar(dy*sp));
      this.camera.position.add(pan); this.target.add(pan);
      this.camera.lookAt(this.target);
    } else if(this.painting){
      this.continue4DPaint(e.clientX,e.clientY);
    }
    this.lastPointerPos={x:e.clientX,y:e.clientY};
  }

  onPointerUp(e){ this.isOrbiting=false; this.isPanning=false; this.end4DPaint(); }

  onWheel(e){
    e.preventDefault();
    const dir=new THREE.Vector3().subVectors(this.camera.position,this.target);
    const sc=Math.exp(-e.deltaY*0.001);
    dir.multiplyScalar(sc);
    const newLen=Math.max(3, Math.min(100, dir.length()));
    dir.setLength(newLen);
    this.camera.position.copy(this.target).add(dir);
    this.camera.lookAt(this.target);
  }

  onResize(){
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hud.resize();
  }

  setTool(t){
    this.params.tool=t;
    document.querySelectorAll('[id^="tool"]').forEach(b=>b.classList.remove('active'));
    document.getElementById('tool'+t).classList.add('active');
    this.updateUI();
  }

  setConsciousnessType(type){
    this.params.consciousnessType=type;
    document.querySelectorAll('[id^="type"]').forEach(b=>b.classList.remove('active'));
    const idMap = { human: 'typeHuman', ai: 'typeAI', hybrid: 'typeHybrid', kernel: 'typeKernel' };
    document.getElementById(idMap[type]).classList.add('active');
    this.updateUI();
  }

  clear4DSpace(){
    this.consciousness4D=new Consciousness4DStore();
    const hide=new THREE.Matrix4().makeScale(0,0,0);
    Object.values(this.instancedMeshes).forEach(mesh=>{
      for(let i=0;i<mesh.count;i++) mesh.setMatrixAt(i,hide);
      mesh.instanceMatrix.needsUpdate=true;
    });
    this.activeInstanceCount={human:0,ai:0,hybrid:0,kernel:0};
    this.activeInstances=0;
    this.updateUI();
    this.setBadge('CLEARED'); setTimeout(()=>this.setBadge('HYPERSPACE READY'), 900);
  }

  async export4DData(){
    const payload = {
      schema:'4d-session/v1',
      app:'4d_consciousness_studio',
      version:'1.0.0',
      timestamp:new Date().toISOString(),
      projection:{
        mode:this.consciousness4D.projectionMode,
        w_slice:this.consciousness4D.wSlice,
        params:Object.fromEntries(Object.entries(projParams).map(([k,v])=>[k,v.value])),
      },
      camera:{ pos:this.camera.position.toArray(), target:this.target.toArray() },
      data:this.consciousness4D.toJSON()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.download=`4d-session-${Date.now()}.json`; a.href=URL.createObjectURL(blob); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),0);
    this.setBadge('EXPORTED'); setTimeout(()=>this.setBadge('HYPERSPACE READY'), 900);
  }

  async import4DData(){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange=async(e)=>{
      const f=e.target.files[0]; if(!f) return;
      const txt=await f.text();
      try{
        const obj=JSON.parse(txt);
        this.clear4DSpace();
        this.consciousness4D.projectionMode = obj.projection?.mode || 'slice';
        this.consciousness4D.wSlice = obj.projection?.w_slice ?? 0;
        document.getElementById('projectionMode').value = this.consciousness4D.projectionMode;
        if (obj.projection?.params){
          Object.entries(obj.projection.params).forEach(([k, v])=>{
            if (projParams[k] && typeof v === 'number'){
              projParams[k].value=v;
              const slider=document.getElementById(`p_${k}`);
              if(slider){ slider.value=Math.max(slider.min,Math.min(slider.max,v)); }
            }
          });
          this.applyValidationStyles();
        }
        if (obj.camera?.pos && obj.camera?.target){ this.camera.position.fromArray(obj.camera.pos); this.target.fromArray(obj.camera.target); this.camera.lookAt(this.target); }
        (obj.data?.nodes||[]).forEach(n => this.consciousness4D.addHyperNode(n.position4D, n.type, n.properties||{}));
        (obj.data?.strokes||[]).forEach(s => this.consciousness4D.addHyperStroke(s));
        this.update3DProjections(); this.refreshProjUI();
        this.setBadge('IMPORTED'); setTimeout(()=>this.setBadge('HYPERSPACE READY'), 1200);
      }catch(err){ console.error(err); this.setBadge('IMPORT ERROR'); setTimeout(()=>this.setBadge('HYPERSPACE READY'), 1600); }
    };
    inp.click();
  }

  setBadge(t){ document.getElementById('statusBadge').textContent = t; }

  updateUI(){
    const names={ '4DBrush':'4D Consciousness Brush','4DNode':'4D Consciousness Node','4DFlow':'4D Flow Stream','4DKernel':'4D Kernel Bridge','4DEraser':'4D Eraser' };
    document.getElementById('currentMode').textContent = names[this.params.tool];
    document.getElementById('activeDimension').textContent = `W=${this.consciousness4D.wSlice.toFixed(1)}`;
    document.getElementById('node4DCount').textContent = this.consciousness4D.stats.totalNodes;
    document.getElementById('stroke4DCount').textContent = this.consciousness4D.stats.hyperStrokeCount;
    document.getElementById('totalNodes').textContent = this.consciousness4D.stats.activeNodes;
    document.getElementById('kernelState').textContent = this.consciousness4D.stats.kernelState.toFixed(2);
    const conv = this.consciousness4D.stats.totalNodes>1 ? Math.random()*0.3+0.5 : 0;
    document.getElementById('convergenceMetric').textContent = conv.toFixed(2);
  }

  animate(){
    requestAnimationFrame(()=>this.animate());
    this.hud.tick();
    this.renderer.render(this.scene, this.camera);
    this.updateUI();
    this.hud.draw({ nodes:this.consciousness4D.stats.totalNodes, strokes:this.consciousness4D.stats.hyperStrokeCount });
    const fpsEl=document.getElementById('fps'); if (fpsEl) fpsEl.textContent = this.hud.smoothed.toFixed(0);
  }
}

// Boot after DOM + THREE present
window.addEventListener('DOMContentLoaded', ()=>{
  if (!window.THREE) { console.error('[4D Studio] THREE not loaded'); return; }
  new Consciousness4DPaintStudio();
});
