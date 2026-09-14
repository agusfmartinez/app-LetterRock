import * as THREE from 'three';

/*
 * La vitrina 3D de la discografía (`<shelf-3d>`). Viene de la maqueta de
 * Claude Design (LetterRock-standalone2.html) con cuatro cambios:
 *  - paleta oscura: la maqueta es crema y acá las fundas se perdían;
 *  - tapas reales: `cover` en cada disco se carga como textura, y mientras
 *    tanto (o si no hay) va la tapa de relleno con el título;
 *  - atributo `tracks`: los temas del disco abierto llegan aparte, cuando la
 *    ficha termina de cargarse, sin rearmar las fundas;
 *  - se libera el contexto WebGL al salir de la pantalla: en una SPA cada
 *    visita crea un elemento nuevo y el navegador corta a los ~16 contextos.
 */

const DEG = Math.PI / 180;
const R_OUT = 1.0, R_PLAY_OUT = 0.945, R_PLAY_IN = 0.335, R_LABEL = 0.3;
const AL = 0.8;                 // lado de la funda en unidades de escena
const FOV = 30;

// Ancho/alto de escena que la cámara tiene que abarcar en cada modo.
const SPAN = {
  stack: { w: 2.5, h: 1.35 },
  row: { w: 3.2, h: 1.35 },
  focus: { w: 2.4, h: 2.6 },
  split: { w: 3.3, h: 2.3 },
};

const secs = (d) => { const p = String(d || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Colores de la paleta rock (tailwind.config.js). La maqueta los leía de
// variables CSS que este proyecto no tiene.
const C = {
  sleeve: '#2a211b',
  cover: '#231c17',
  stripe: '#2c231d',
  muted: '#8a7a6c',
  text: '#efe8e1',
};

// Reparte los surcos por duración real: el track 1 ocupa el borde exterior.
function makeBands(tracks) {
  const list = tracks || [];
  const total = list.reduce((a, t) => a + secs(t.dur), 0) || 1;
  const span = R_PLAY_OUT - R_PLAY_IN;
  let cum = 0;
  const out = list.map((t, i) => {
    const a = cum; cum += secs(t.dur);
    return {
      n: t.n != null ? t.n : i + 1, title: t.title || '', dur: t.dur || '',
      rOut: R_PLAY_OUT - (a / total) * span,
      rIn: R_PLAY_OUT - (cum / total) * span,
    };
  });
  const n = out.length;
  return out.map((b, i) => ({
    ...b,
    rMid: (b.rIn + b.rOut) / 2,
    a: (n > 1 ? 56 - (i / (n - 1)) * 112 : 0) * DEG,
  }));
}

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Portada placeholder: las mismas rayas a 135° de las maquetas, con el título.
function coverTexture(title) {
  const S = 768, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = C.cover;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = C.stripe;
  g.lineWidth = S / 46;
  g.save(); g.translate(S / 2, S / 2); g.rotate(-45 * DEG); g.translate(-S, -S);
  for (let y = 0; y < S * 2; y += S / 23) { g.beginPath(); g.moveTo(0, y); g.lineTo(S * 2, y); g.stroke(); }
  g.restore();
  g.textAlign = 'left';
  g.fillStyle = C.text;
  const size = S * 0.07;
  g.font = `${size}px Caprasimo, Georgia, serif`;
  const words = String(title || '').split(' ');
  const lines = []; let line = '';
  words.forEach((w) => {
    if (g.measureText((line + ' ' + w).trim()).width > S * 0.78 && line) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  });
  if (line.trim()) lines.push(line.trim());
  const shown = lines.slice(0, 3);
  shown.forEach((l, i) => g.fillText(l, S * 0.09, S * 0.9 - (shown.length - 1 - i) * size * 1.06));

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function grooveTexture(bands) {
  const S = 1536, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, px = (r) => r * C;
  g.fillStyle = '#0b0a0b'; g.fillRect(0, 0, S, S);
  const grad = g.createRadialGradient(C, C, px(0.3), C, C, px(1));
  grad.addColorStop(0, '#242124'); grad.addColorStop(0.55, '#141315'); grad.addColorStop(1, '#0a0a0b');
  g.fillStyle = grad; g.beginPath(); g.arc(C, C, px(R_OUT), 0, Math.PI * 2); g.fill();

  g.lineWidth = 1;
  for (let r = R_LABEL; r < R_OUT; r += 0.0021) {
    const t = (r - R_LABEL) / (R_OUT - R_LABEL);
    g.strokeStyle = `rgba(255,252,246,${0.05 + 0.05 * Math.sin(t * 140)})`;
    g.beginPath(); g.arc(C, C, px(r), 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.arc(C, C, px(r + 0.001), 0, Math.PI * 2); g.stroke();
  }
  // Separación lisa entre tracks, como en un disco real.
  bands.forEach((b) => {
    g.strokeStyle = 'rgba(255,250,242,0.2)'; g.lineWidth = 4;
    g.beginPath(); g.arc(C, C, px(b.rIn), 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(C, C, px(b.rIn - 0.004), 0, Math.PI * 2); g.stroke();
  });
  g.strokeStyle = 'rgba(255,250,242,0.16)'; g.lineWidth = 4;
  g.beginPath(); g.arc(C, C, px(R_PLAY_OUT + 0.014), 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#0e0d0e';
  g.beginPath(); g.arc(C, C, px(R_LABEL + 0.006), 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(accent, title, artist, year) {
  const S = 768, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, u = C / 1.06;
  g.fillStyle = accent;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(20,18,17,0.32)'; g.lineWidth = 5;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(C, C); g.textAlign = 'center'; g.fillStyle = '#1a1817';
  g.font = `${u * 0.28}px Caprasimo, Georgia, serif`;
  g.fillText(String(artist || '').toUpperCase(), 0, -u * 0.3);
  g.font = `600 ${u * 0.13}px Figtree, system-ui, sans-serif`;
  const words = String(title || '').split(' ');
  const lines = []; let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > 18) { lines.push(line.trim()); line = w; } else line += ' ' + w;
  });
  if (line.trim()) lines.push(line.trim());
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 0, u * 0.32 + i * u * 0.18));
  g.font = `${u * 0.1}px ui-monospace, monospace`;
  g.fillStyle = 'rgba(26,24,23,0.72)';
  g.fillText(String(year || ''), 0, u * 0.82);
  g.beginPath(); g.arc(0, 0, u * 0.085, 0, Math.PI * 2); g.fillStyle = '#0d0c0d'; g.fill();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sheenTexture() {
  const S = 768, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2;
  const cone = g.createConicGradient ? g.createConicGradient(0, C, C) : null;
  if (cone) {
    [[0, 'rgba(0,0,0,0)'], [0.055, 'rgba(255,246,228,0.18)'], [0.13, 'rgba(0,0,0,0)'],
     [0.47, 'rgba(0,0,0,0)'], [0.53, 'rgba(255,246,228,0.09)'], [0.6, 'rgba(0,0,0,0)'],
     [1, 'rgba(0,0,0,0)']].forEach(([s, col]) => cone.addColorStop(s, col));
    g.fillStyle = cone;
  } else g.fillStyle = 'rgba(255,246,228,0.14)';
  g.fillRect(0, 0, S, S);
  const mask = g.createRadialGradient(C, C, C * 0.4, C, C, C);
  mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(0.75, 'rgba(0,0,0,0.55)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = mask; g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Shelf3D extends HTMLElement {
  static get observedAttributes() { return ['albums', 'tracks', 'layout', 'mode', 'sel', 'accent', 'artist']; }

  // El loop se vigila solo: si React mueve el nodo y el rAF queda cancelado,
  // el perro guardián lo vuelve a arrancar sin rearmar la escena.
  _start() {
    cancelAnimationFrame(this._raf);
    this._tick = performance.now();
    this._loop();
  }

  _watchdog() {
    if (this._watch) return;
    this._watch = setInterval(() => {
      if (this.isConnected && performance.now() - (this._tick || 0) > 400) this._start();
    }, 400);
  }

  connectedCallback() {
    clearTimeout(this._teardown);
    if (this._dead) return;
    if (this._up) {
      if (this._ro) this._ro.observe(this);
      this._watchdog();
      this._start();
      return;
    }
    this._up = true;
    this._covers = new Map();
    this._loader = new THREE.TextureLoader();
    this._loader.setCrossOrigin('anonymous');
    this._root = this.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = ':host{position:relative;display:block;width:100%;height:100%;overflow:hidden}' +
      'canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y}' +
      'svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}' +
      '.labels{position:absolute;inset:0;pointer-events:none}';
    this._root.appendChild(st);

    this._albums = this._parse();
    this._layout = this._attr('layout') || 'stack';
    this._mode = this._attr('mode') || 'browse';
    this._focus = +(this._attr('sel') || 0);
    this._cursor = this._focus || 0;
    this._hover = 0;
    this._bands = [];
    this._bandsFor = -1;
    this._camDist = 7;
    this._camTgtY = 0;
    this._camDir = new THREE.Vector3(0, 0.14, 1).normalize();
    this._build();
    document.fonts.ready.then(() => {
      if (this._dead) return;
      this._retexture(); this._rebuildAlbums(); this._bandsFor = -1;
    });
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.unobserve(this);
    // Diferido: si React sólo movió el nodo, vuelve a conectarse en el mismo
    // tick y no hay que rearmar nada. Si no vuelve, se libera todo.
    clearTimeout(this._teardown);
    this._teardown = setTimeout(() => { if (!this.isConnected) this._destroy(); }, 0);
  }

  _destroy() {
    this._dead = true;
    clearInterval(this._watch);
    if (this._ro) this._ro.disconnect();
    if (!this._scene) return;
    this._scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    this._covers.forEach((tex) => tex && tex.dispose && tex.dispose());
    this._renderer.dispose();
    this._renderer.forceContextLoss();
  }

  attributeChangedCallback(name, old, val) {
    if (!this._up || this._dead || old === val) return;
    if (name === 'albums') { this._albums = this._parse(); this._rebuildAlbums(); this._bandsFor = -1; }
    if (name === 'tracks') this._bandsFor = -1;
    if (name === 'layout') this._layout = val || 'stack';
    if (name === 'sel') { const n = +val || 0; if (n !== this._focus) { this._focus = n; this._cursor = n; } }
    if (name === 'mode' && val && val !== this._mode) {
      this._mode = val;
      if (val === 'browse') this._setHover(0);
    }
    if (name === 'accent' || name === 'artist') { this._retexture(); this._bandsFor = -1; }
  }

  _attr(name) {
    const camel = name.replace(/-([a-z])/g, (m, ch) => ch.toUpperCase()).toLowerCase();
    return this.getAttribute(name) ?? this.getAttribute(camel);
  }

  _accent() { return this._attr('accent') || '#c1592c'; }

  _parse(name = 'albums') {
    const raw = (this._attr(name) || '').trim();
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  _album() { return this._albums[this._focus] || this._albums[0] || {}; }

  _build() {
    const w = this.clientWidth || 900, h = this.clientHeight || 560;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this._root.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this._scene = scene;
    const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 60);
    this._camera = camera;

    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x241f1c, 0.5));
    const key = new THREE.DirectionalLight(0xfff6e6, 1.05);
    key.position.set(-2.2, 3.0, 4.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf4e6d2, 0.5);
    rim.position.set(3.4, 1.2, -1.8);
    scene.add(rim);

    this._shelf = new THREE.Group();
    scene.add(this._shelf);
    this._items = [];
    this._rebuildAlbums();

    this._buildVinyl();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._root.appendChild(svg);
    this._svg = svg;
    this._lines = [];
    const wrap = document.createElement('div');
    wrap.className = 'labels';
    wrap.appendChild(document.createElement('slot'));
    this._root.appendChild(wrap);

    this._wire();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._resize();
    this._camDist = this._dist();
    this._watchdog();
    this._start();
  }

  _rebuildAlbums() {
    if (!this._shelf) return;
    this._items.forEach((it) => {
      this._shelf.remove(it.g);
      it.g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          // Las tapas reales quedan en caché: rearmar las fundas (p. ej. cuando
          // cargan las fuentes) no tiene que volver a bajarlas.
          if (o.material.map && !o.material.map.userData.cached) o.material.map.dispose();
          o.material.dispose();
        }
      });
    });
    const sleeveGeo = new THREE.ExtrudeGeometry(roundedShape(AL, AL, 0.075), { depth: 0.032, bevelEnabled: false, curveSegments: 10 });
    sleeveGeo.center();
    const faceGeo = new THREE.ShapeGeometry(roundedShape(AL, AL, 0.075), 10);
    const pos = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / AL + 0.5, pos.getY(i) / AL + 0.5);
    uv.needsUpdate = true;

    this._items = this._albums.map((a, i) => {
      const g = new THREE.Group();
      const sleeve = new THREE.Mesh(sleeveGeo.clone(), new THREE.MeshStandardMaterial({
        color: new THREE.Color(C.sleeve), roughness: 0.88, transparent: true,
      }));
      const face = new THREE.Mesh(faceGeo.clone(), new THREE.MeshStandardMaterial({
        map: coverTexture(a.title), roughness: 0.72, transparent: true,
      }));
      if (a.cover) this._cover(a.cover, face.material);
      face.position.z = 0.018;
      face.userData.index = i;
      g.add(sleeve, face);
      this._shelf.add(g);
      return { g, face, mats: [sleeve.material, face.material], cur: { x: 0, y: 0, z: 0, ry: 0, rz: 0, s: 1, o: 0 } };
    });
    sleeveGeo.dispose(); faceGeo.dispose();
  }

  // Pone la tapa real sobre la de relleno cuando termina de bajar. Si falla
  // (CORS, 404), queda la de relleno: el título se sigue leyendo.
  _cover(url, mat) {
    const apply = (tex) => {
      if (this._dead || !tex) return;
      if (mat.map && !mat.map.userData.cached) mat.map.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
    };
    const hit = this._covers.get(url);
    if (hit) { if (hit.then) hit.then(apply); else apply(hit); return; }
    const pending = new Promise((resolve) => {
      this._loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.userData.cached = true;
        this._covers.set(url, tex);
        resolve(tex);
      }, undefined, () => { this._covers.set(url, null); resolve(null); });
    });
    this._covers.set(url, pending);
    pending.then(apply);
  }

  _buildVinyl() {
    const vg = new THREE.Group();
    vg.name = 'vinyl';
    this._scene.add(vg);
    this._vinyl = vg;

    this._grooveMat = new THREE.MeshPhysicalMaterial({
      map: grooveTexture([]), roughness: 0.26, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true,
    });
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x121112, roughness: 0.4, clearcoat: 0.7, transparent: true });
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(R_OUT, R_OUT, 0.016, 192, 1, false),
      [edgeMat, this._grooveMat, edgeMat.clone()]
    );
    disc.rotation.x = Math.PI / 2;
    vg.add(disc);
    this._disc = disc;

    const sheen = new THREE.Mesh(
      new THREE.RingGeometry(R_LABEL + 0.012, R_OUT * 0.995, 96, 1),
      new THREE.MeshBasicMaterial({ map: sheenTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sheen.position.z = 0.0095;
    vg.add(sheen);
    this._sheen = sheen;

    this._labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(this._accent(), '', '', ''), roughness: 0.82, transparent: true });
    const sello = new THREE.Mesh(new THREE.CircleGeometry(R_LABEL + 0.004, 72), this._labelMat);
    sello.position.z = 0.0105;
    vg.add(sello);

    const glow = () => new THREE.MeshBasicMaterial({
      color: new THREE.Color(this._accent()), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this._ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 144), glow());
    this._ring.position.z = 0.012;
    vg.add(this._ring);
    this._edges = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.51, 144), glow());
      m.position.z = 0.0125;
      vg.add(m);
      return m;
    });

    sheen.material.name = 'sheen';
    this._vinylMats = [this._grooveMat, edgeMat, this._labelMat, sheen.material];
    vg.scale.setScalar(0.2);
    vg.visible = false;
    this._vcur = { x: 0, z: 0, s: 0.2, o: 0 };
  }

  _setBands() {
    const a = this._album();
    this._bands = makeBands(this._parse('tracks'));
    if (this._grooveMat.map) this._grooveMat.map.dispose();
    this._grooveMat.map = grooveTexture(this._bands);
    this._grooveMat.needsUpdate = true;
    if (this._labelMat.map) this._labelMat.map.dispose();
    this._labelMat.map = labelTexture(this._accent(), a.title, this._attr('artist') || '', a.year);
    this._labelMat.needsUpdate = true;
    this._lines.forEach((l) => l.remove());
    this._lines = this._bands.map(() => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('stroke', C.muted);
      l.setAttribute('stroke-width', '1');
      l.setAttribute('opacity', '0');
      this._svg.appendChild(l);
      return l;
    });
    this._setHover(0);
  }

  _retexture() {
    if (!this._ring) return;
    this._ring.material.color = new THREE.Color(this._accent());
    this._edges.forEach((e) => { e.material.color = new THREE.Color(this._accent()); });
  }

  _setHover(n) {
    if (n === this._hover) return;
    this._hover = n;
    const b = this._bands.find((x) => x.n === n);
    if (b) {
      this._ring.geometry.dispose();
      this._ring.geometry = new THREE.RingGeometry(b.rIn + 0.005, b.rOut - 0.005, 144);
      this._edges[0].geometry.dispose();
      this._edges[0].geometry = new THREE.RingGeometry(b.rOut - 0.013, b.rOut - 0.002, 144);
      this._edges[1].geometry.dispose();
      this._edges[1].geometry = new THREE.RingGeometry(b.rIn + 0.002, b.rIn + 0.013, 144);
    }
    this._ringTarget = b ? 0.2 : 0;
    this._edgeTarget = b ? 0.85 : 0;
  }

  // Un toque/clic: abre la funda, saca el vinilo, o elige un surco.
  _tap(ev, aim, hitGroove, hitAlbum) {
    aim(ev);
    const n = hitGroove();
    if (n) {
      // Sin hover en touch: el primer toque destaca el surco, el segundo abre el tema.
      if (ev.pointerType === 'touch' && this._hover !== n) { this._setHover(n); return; }
      const b = this._bands.find((x) => x.n === n);
      this.dispatchEvent(new CustomEvent('shelf-track', { bubbles: true, composed: true, detail: { n, title: b ? b.title : '' } }));
      return;
    }
    const i = hitAlbum();
    if (this._mode === 'browse') { if (i >= 0) this._setMode('focus', i); return; }
    if (this._mode === 'focus') { this._setMode(i >= 0 ? 'split' : 'browse', i >= 0 ? i : null); return; }
    this._setMode('focus');
  }

  _setMode(mode, index) {
    if (index != null) { this._focus = index; this._cursor = index; }
    this._mode = mode;
    this.dispatchEvent(new CustomEvent('shelf-mode', { bubbles: true, composed: true, detail: { mode, index: this._focus } }));
  }

  _wire() {
    const el = this._renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const aim = (ev) => {
      const r = el.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this._camera);
    };
    const hitAlbum = () => {
      const faces = this._items.filter((it) => it.cur.o > 0.25).map((it) => it.face);
      const is = ray.intersectObjects(faces, false);
      return is.length ? is[0].object.userData.index : -1;
    };
    const hitGroove = () => {
      if (this._mode !== 'split') return 0;
      const is = ray.intersectObject(this._disc, false);
      if (!is.length) return 0;
      const p = this._vinyl.worldToLocal(is[0].point.clone());
      const rad = Math.hypot(p.x, p.y);
      const b = this._bands.find((bb) => rad <= bb.rOut + 0.004 && rad >= bb.rIn - 0.004);
      return b ? b.n : 0;
    };

    el.addEventListener('pointermove', (ev) => {
      if (this._drag) {
        // Arrastre: 1 disco cada ~110px de recorrido horizontal o vertical.
        const d = this._drag;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
        if (this._mode === 'browse' && this._albums.length) {
          this._cursor = clamp(d.cursor - (dx + dy * 0.6) / 110, 0, this._albums.length - 1);
        }
        return;
      }
      if (ev.pointerType === 'touch') return;
      aim(ev);
      const n = hitGroove();
      if (this._mode === 'split') this._setHover(n);
      el.style.cursor = n || hitAlbum() >= 0 ? 'pointer' : 'default';
    });

    el.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      this._drag = { x: ev.clientX, y: ev.clientY, cursor: this._cursor, moved: false, id: ev.pointerId };
      // Sólo capturo el dedo con el listado abierto: con un disco abierto el
      // gesto vertical tiene que seguir scrolleando la página.
      if (this._mode === 'browse') { try { el.setPointerCapture(ev.pointerId); } catch (e) {} }
    });

    const endDrag = (ev) => {
      const d = this._drag;
      this._drag = null;
      try { el.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (!d) return null;
      if (this._mode === 'browse') this._cursor = clamp(Math.round(this._cursor), 0, Math.max(0, this._albums.length - 1));
      if (d.moved) this._dragged = true;
      return d;
    };
    el.addEventListener('pointerup', (ev) => {
      const d = endDrag(ev);
      // Un toque corto sin desplazamiento cuenta como clic. Marco el gesto para
      // que el click sintético que el navegador agrega después no lo repita.
      if (d && !d.moved && ev.pointerType === 'touch') {
        this._tapped = true;
        this._tap(ev, aim, hitGroove, hitAlbum);
      }
    });
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('pointerleave', () => {
      clearTimeout(this._hoverOff);
      this._hoverOff = setTimeout(() => this._setHover(0), 160);
    });

    el.addEventListener('click', (ev) => {
      if (this._tapped) { this._tapped = false; return; }
      if (this._dragged) { this._dragged = false; return; }
      this._tap(ev, aim, hitGroove, hitAlbum);
    });

    el.addEventListener('wheel', (ev) => {
      if (this._drag) return;
      if (this._mode !== 'browse' || !this._albums.length) return;
      // En los extremos de la pila dejo que siga scrolleando la página.
      const next = clamp(this._cursor + ev.deltaY * 0.0042, 0, this._albums.length - 1);
      if (next === this._cursor) return;
      ev.preventDefault();
      this._cursor = next;
    }, { passive: false });

    this.tabIndex = 0;
    this.addEventListener('keydown', (ev) => {
      const last = this._albums.length - 1;
      if (ev.key === 'Escape' && this._mode !== 'browse') { this._setMode(this._mode === 'split' ? 'focus' : 'browse'); ev.preventDefault(); }
      if (this._mode !== 'browse') return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { this._cursor = clamp(Math.round(this._cursor) + 1, 0, last); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { this._cursor = clamp(Math.round(this._cursor) - 1, 0, last); ev.preventDefault(); }
      if (ev.key === 'Enter') { this._setMode('focus', Math.round(this._cursor)); ev.preventDefault(); }
    });
  }

  _target(i) {
    const m = this._mode, d = i - this._cursor;
    if (m !== 'browse') {
      if (i !== this._focus) return { x: d < 0 ? -3.6 : 3.6, y: 0, z: -2.4, ry: 0, rz: 0, s: 0.9, o: 0 };
      if (m === 'focus') return { x: 0, y: 0, z: 0.55, ry: 0, rz: 0, s: 1.55, o: 1 };
      return { x: -0.74, y: 0, z: 0.5, ry: 0.17, rz: 0, s: 1.18, o: 1 };
    }
    if (this._layout === 'row') {
      return {
        x: d * 1.06, y: 0, z: -Math.abs(d) * 0.26, ry: -d * 0.085, rz: 0, s: 1,
        o: clamp(2.7 - Math.abs(d), 0, 1),
      };
    }
    if (d < 0) return { x: -1.35 + d * 0.28, y: 0.05, z: 0.55 - d * 0.06, ry: 0.7, rz: 0.02, s: 1, o: clamp(1 + d * 0.75, 0, 1) };
    return { x: d * 0.34, y: -d * 0.05, z: -d * 0.34, ry: 0.44, rz: -0.03, s: 1, o: clamp(1.85 - d * 0.45, 0, 1) };
  }

  _vinylTarget() {
    if (this._mode === 'split') return { x: 0.74, z: 0.48, s: 0.48, o: 1 };
    if (this._mode === 'focus') return { x: 0, z: 0.46, s: 0.46, o: 1 };
    return { x: 0, z: 0.2, s: 0.2, o: 0 };
  }

  _dist() {
    const s = SPAN[this._mode === 'browse' ? (this._layout === 'row' ? 'row' : 'stack') : this._mode] || SPAN.stack;
    const halfH = Math.tan((FOV * DEG) / 2);
    return Math.max((s.w / 2) / (halfH * (this._camera.aspect || 1.6)), (s.h / 2) / halfH);
  }

  _resize() {
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h || (w === this._w && h === this._h)) return;
    this._w = w; this._h = h;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _place() {
    const r = this.getBoundingClientRect();
    if (!r.width || !this._bands.length) return;
    const split = this._mode === 'split' && this._vcur.o > 0.7;
    const v = new THREE.Vector3(), o = new THREE.Vector3();
    this._bands.forEach((b, i) => {
      const on = split && b.n === this._hover;
      const el = this.querySelector(`[data-shelf-track="${b.n}"]`);
      v.set(Math.cos(b.a) * b.rMid, Math.sin(b.a) * b.rMid, 0.03);
      this._vinyl.localToWorld(v).project(this._camera);
      const dx = (v.x * 0.5 + 0.5) * r.width, dy = (-v.y * 0.5 + 0.5) * r.height;
      o.set(Math.cos(b.a) * 1.16, Math.sin(b.a) * 1.16, 0);
      this._vinyl.localToWorld(o).project(this._camera);
      let lx = (o.x * 0.5 + 0.5) * r.width;
      const ly = (-o.y * 0.5 + 0.5) * r.height;
      if (el) {
        const bw = el.offsetWidth || 150;
        lx = clamp(lx, 8, Math.max(8, r.width - bw - 10));
        el.style.position = 'absolute';
        el.style.left = lx + 'px';
        el.style.top = ly + 'px';
        el.style.transform = 'translateY(-50%)';
        el.style.opacity = on ? '1' : '0';
        el.style.pointerEvents = on ? 'auto' : 'none';
        el.style.transition = 'opacity .18s ease';
        if (!el._wired) {
          el._wired = true;
          el.addEventListener('pointerenter', () => { clearTimeout(this._hoverOff); this._setHover(b.n); });
        }
      }
      const l = this._lines[i];
      if (l) {
        l.setAttribute('x1', lx); l.setAttribute('y1', ly);
        l.setAttribute('x2', dx); l.setAttribute('y2', dy);
        l.setAttribute('opacity', on ? 0.5 : 0);
      }
    });
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    const now = performance.now();
    // Interpolación por tiempo, no por frame: si el navegador estrangula el
    // rAF (pestaña de fondo, captura), la transición igual llega a destino.
    const dt = clamp((now - (this._tick || now)) / 1000, 0, 0.4);
    this._tick = now;
    this._resize();
    if (this._bandsFor !== this._focus) { this._bandsFor = this._focus; this._setBands(); }

    const t = now / 1000;
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    const k = ease(7.5);
    const calm = this._mode === 'browse' ? 1 : 0.34;

    this._items.forEach((it, i) => {
      const tg = this._target(i), c = it.cur;
      c.x += (tg.x - c.x) * k; c.y += (tg.y - c.y) * k; c.z += (tg.z - c.z) * k;
      c.ry += (tg.ry - c.ry) * k; c.rz += (tg.rz - c.rz) * k;
      c.s += (tg.s - c.s) * k; c.o += (tg.o - c.o) * k;
      // Flotan: cada funda con su propia fase, nunca al unísono.
      it.g.position.set(c.x, c.y + Math.sin(t * 0.78 + i * 1.7) * 0.042 * calm, c.z);
      it.g.rotation.set(Math.sin(t * 0.52 + i * 2.1) * 0.022 * calm, c.ry, c.rz + Math.sin(t * 0.63 + i) * 0.014 * calm);
      it.g.scale.setScalar(c.s);
      it.g.visible = c.o > 0.01;
      // Sólo mezclo cuando de verdad hace falta: una funda opaca no puede
      // dejar ver la que tiene atrás.
      const blend = c.o < 0.99;
      it.g.renderOrder = blend ? -Math.round(c.z * 100) : 0;
      it.mats.forEach((m) => {
        m.opacity = c.o;
        if (m.transparent !== blend) { m.transparent = blend; m.needsUpdate = true; }
        if (m.depthWrite === blend) m.depthWrite = !blend;
      });
    });

    const vt = this._vinylTarget(), vc = this._vcur;
    vc.x += (vt.x - vc.x) * k; vc.z += (vt.z - vc.z) * k;
    vc.s += (vt.s - vc.s) * k; vc.o += (vt.o - vc.o) * k;
    this._vinyl.position.set(vc.x, Math.sin(t * 0.7 + 0.9) * 0.03 * calm, vc.z);
    this._vinyl.rotation.set(Math.sin(t * 0.46) * 0.018 * calm, Math.sin(t * 0.38) * 0.03 * calm, 0);
    this._vinyl.scale.setScalar(vc.s);
    this._vinyl.visible = vc.o > 0.02;
    const vblend = vc.o < 0.995;
    this._vinylMats.forEach((m) => {
      m.opacity = vc.o;
      if (m.name !== 'sheen' && m.transparent !== vblend) { m.transparent = vblend; m.needsUpdate = true; }
    });
    this._sheen.rotation.z = t * 0.12;

    const kg = ease(9.5);
    const rm = this._ring.material;
    rm.opacity += ((this._ringTarget || 0) * vc.o - rm.opacity) * kg;
    this._edges.forEach((e) => { e.material.opacity += ((this._edgeTarget || 0) * vc.o - e.material.opacity) * kg; });

    const dir = this._mode !== 'browse'
      ? new THREE.Vector3(0, 0.03, 1)
      : (this._layout === 'row' ? new THREE.Vector3(0, 0.13, 1) : new THREE.Vector3(0.17, 0.12, 1));
    const kc = ease(4.5);
    this._camDir.lerp(dir.normalize(), kc);
    this._camDist += (this._dist() - this._camDist) * kc;
    this._camera.position.copy(this._camDir).normalize().multiplyScalar(this._camDist);
    // Con el disco abierto subo el encuadre: abajo va el nombre y el año.
    this._camTgtY += ((this._mode === 'browse' ? 0 : -0.34) - this._camTgtY) * kc;
    this._camera.lookAt(0, this._camTgtY, 0);

    this._renderer.render(this._scene, this._camera);
    this._place();
  };
}

if (!customElements.get('shelf-3d')) customElements.define('shelf-3d', Shelf3D);
