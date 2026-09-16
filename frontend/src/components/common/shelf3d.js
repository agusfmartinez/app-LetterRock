import * as THREE from 'three';
import { HALO, VINYL, haloTexture, labelTexture } from './vinylLook.js';

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
 *
 * Y vive dentro de la ficha del artista, en el lugar de la grilla 2D:
 *  - la pila es vertical: el primer disco arriba, la rueda hacia abajo baja
 *    por la pila y hacia arriba vuelve al primero;
 *  - `intro(rects)` arranca cada funda exactamente donde estaba su tapa en la
 *    grilla y `outro(rects)` las devuelve ahí: la grilla se transforma en la
 *    pila y vuelve, sin sentirse otra pantalla;
 *  - la rueda sólo se toma con el panel entero a la vista, y en los extremos
 *    de la pila se suelta: se puede atravesar la sección scrolleando.
 */

const DEG = Math.PI / 180;
const R_OUT = 1.0, R_PLAY_OUT = 0.945, R_PLAY_IN = 0.335, R_LABEL = 0.3;
const AL = 0.8;                 // lado de la funda en unidades de escena
const FOV = 30;

// Ancho/alto de escena que la cámara tiene que abarcar en cada modo.
const SPAN = {
  stack: { w: 1.3, h: 1.9 },
  row: { w: 3.2, h: 1.35 },
  focus: { w: 2.4, h: 2.6 },
  split: { w: 3.3, h: 2.3 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Colores de la paleta rock (tailwind.config.js). La maqueta los leía de
// variables CSS que este proyecto no tiene.
const C = {
  sleeve: '#2a211b',
  cover: '#231c17',
  muted: '#8a7a6c',
};

/*
 * Reparte los surcos, el track 1 en el borde exterior. Todos del mismo ancho:
 * por duración real era más fiel a un disco, pero las franjas quedaban muy
 * dispares (un tema de 6 minutos, el triple que uno de 2) y los cortos eran
 * difíciles de apuntar con el mouse.
 */
function makeBands(tracks) {
  const list = tracks || [];
  const span = (R_PLAY_OUT - R_PLAY_IN) / (list.length || 1);
  const out = list.map((t, i) => ({
    n: t.n != null ? t.n : i + 1, title: t.title || '', dur: t.dur || '',
    rOut: R_PLAY_OUT - i * span,
    rIn: R_PLAY_OUT - (i + 1) * span,
  }));
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

function grooveTexture(bands) {
  const S = 1536, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, px = (r) => r * C;
  g.fillStyle = '#0b0a0b'; g.fillRect(0, 0, S, S);
  const grad = g.createRadialGradient(C, C, px(0.3), C, C, px(1));
  // Colores: VINYL, en vinylLook.js (compartidos con la ficha del disco).
  grad.addColorStop(0, VINYL.grooveCenter); grad.addColorStop(0.55, VINYL.grooveMid); grad.addColorStop(1, VINYL.grooveEdge);
  g.fillStyle = grad; g.beginPath(); g.arc(C, C, px(R_OUT), 0, Math.PI * 2); g.fill();

  g.lineWidth = 1;
  for (let r = R_LABEL; r < R_OUT; r += 0.0021) {
    const t = (r - R_LABEL) / (R_OUT - R_LABEL);
    g.strokeStyle = `rgba(255,252,246,${VINYL.grooveLight.base + VINYL.grooveLight.wave * Math.sin(t * 140)})`;
    g.beginPath(); g.arc(C, C, px(r), 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `rgba(0,0,0,${VINYL.grooveShadow})`;
    g.beginPath(); g.arc(C, C, px(r + 0.001), 0, Math.PI * 2); g.stroke();
  }
  // Separación lisa entre tracks, como en un disco real.
  bands.forEach((b) => {
    g.strokeStyle = `rgba(255,250,242,${VINYL.trackGap})`; g.lineWidth = 4;
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

// El sello (artista palabra por palabra, que se achica hasta entrar), el halo
// y los colores se comparten con el vinilo de la ficha del disco.
const LABEL_SIZE = 768;

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
  static get observedAttributes() { return ['albums', 'tracks', 'zones', 'layout', 'mode', 'sel', 'accent', 'artist']; }

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
      if (this.isConnected && this._onscreen && performance.now() - (this._tick || 0) > 400) this._start();
    }, 400);
  }

  connectedCallback() {
    clearTimeout(this._teardown);
    if (this._dead) return;
    if (this._up) {
      if (this._ro) this._ro.observe(this);
      if (this._io) this._io.observe(this);
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
    this._zones = this._json('zones');
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
    // El sello del vinilo lleva texto en Caprasimo/Figtree: se redibuja cuando
    // terminan de cargar. Las fundas ya no tienen texto y no se rearman.
    document.fonts.ready.then(() => {
      if (this._dead) return;
      this._retexture(); this._bandsFor = -1;
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
    if (this._io) this._io.disconnect();
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
    if (name === 'zones') this._zones = this._json('zones');
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

  /** Un atributo con un objeto JSON adentro (hoy, `zones`). */
  _json(name) {
    const raw = (this._attr(name) || '').trim();
    if (!raw) return null;
    try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }

  _album() { return this._albums[this._focus] || this._albums[0] || {}; }

  _build() {
    const w = this.clientWidth || 900, h = this.clientHeight || 560;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    // En pantallas táctiles, 1.5 como máximo: los teléfonos suelen ser 3x, y
    // a esa densidad la diferencia no se ve pero la placa dibuja el doble.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this._root.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this._scene = scene;
    const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 60);
    this._camera = camera;

    // Más luz que en la maqueta: sobre fondo oscuro y con tapas reales, las
    // fundas se veían bastante más apagadas que las mismas tapas en la grilla.
    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a302a, 1.0));
    const key = new THREE.DirectionalLight(0xfff6e6, 1.5);
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
    // Fuera de pantalla no se dibuja: la pila flota todo el tiempo, y seguir
    // a 60 cuadros mientras se leen las opiniones de abajo gasta batería por
    // nada. Al volver a verse, retoma.
    this._onscreen = true;
    this._io = new IntersectionObserver(([entry]) => {
      this._onscreen = entry.isIntersecting;
      if (this._onscreen && !this._dead) this._start();
    });
    this._io.observe(this);
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

    // Las posiciones actuales sobreviven al rearmado (cargan las fuentes,
    // cambia el filtro): si no, una funda en pleno vuelo desde la grilla
    // saltaría al centro.
    const prev = this._items;
    this._items = this._albums.map((a, i) => {
      const g = new THREE.Group();
      const sleeve = new THREE.Mesh(sleeveGeo.clone(), new THREE.MeshStandardMaterial({
        color: new THREE.Color(C.sleeve), roughness: 0.88, transparent: true,
      }));
      const face = new THREE.Mesh(faceGeo.clone(), new THREE.MeshStandardMaterial({
        // Sin tapa de relleno: todos los discos tienen imagen, y dibujar una
        // por disco costaba ~3MB de memoria de video cada una. Mientras baja
        // la imagen (o si falla) la cara queda del color de la funda.
        color: new THREE.Color(C.cover), roughness: 0.72, transparent: true,
      }));
      /*
       * La tapa brilla un poco por sí sola y no pasa por el tone mapping: así
       * se ve casi igual que la imagen de la grilla, y el pase entre las dos
       * vistas no cambia de color. La luz sigue sumando el volumen. El brillo
       * se enciende recién con la imagen puesta (ver `_cover`).
       */
      face.material.emissive = new THREE.Color(0x000000);
      face.material.emissiveIntensity = 0.55;
      face.material.toneMapped = false;
      if (a.cover) this._cover(a.cover, face.material);
      face.position.z = 0.018;
      face.userData.index = i;
      g.add(sleeve, face);
      this._shelf.add(g);
      const old = prev[i];
      return {
        g, face, mats: [sleeve.material, face.material],
        cur: old ? old.cur : { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 0 },
        hold: old ? old.hold : 0,
      };
    });
    sleeveGeo.dispose(); faceGeo.dispose();
  }

  /** Un disco para adelante (1) o para atrás (-1) en la pila. Lo usan las flechas. */
  step(delta) {
    if (!this._up || this._dead || this._mode !== 'browse' || !this._albums.length) return;
    this._cursor = clamp(Math.round(this._cursor) + delta, 0, this._albums.length - 1);
  }

  /** Resuelve cuando bajaron las tapas pendientes, o a los `ms` igual. */
  coversReady(ms = 900) {
    const pending = [...(this._covers?.values() || [])].filter((v) => v && v.then);
    return Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, ms))]);
  }

  /**
   * Arranca las fundas donde están las tapas de la grilla (`rects` en px,
   * relativos al elemento, en el mismo orden que `albums`) y las deja volar a
   * la pila, un poco escalonadas para que se lea el movimiento.
   */
  intro(rects = []) {
    if (!this._up || this._dead) return;
    this._outro = null;
    this._mode = 'browse';
    this._focus = 0;
    this._cursor = 0;
    this._snapCamera();
    const now = performance.now();
    this._items.forEach((it, i) => {
      const r = rects[i];
      if (!r) return;
      Object.assign(it.cur, this._screenPose(r));
      it.hold = now + 40 + Math.min(i * 26, 520);
    });
  }

  /** Lo inverso: cada funda vuelve al lugar de su tapa en la grilla. */
  outro(rects = []) {
    if (!this._up || this._dead) return;
    this._mode = 'browse';
    this._setHover(0);
    this._outro = rects;
    this._items.forEach((it) => { it.hold = 0; });
  }

  // Dónde tiene que estar una funda para verse exactamente sobre un rectángulo
  // de pantalla: en el plano paralelo a la imagen que pasa por el punto al que
  // mira la cámara, girada igual que la cámara (así no hay deformación) y con
  // la escala que da ese ancho en px a esa distancia.
  /*
   * Con el vinilo afuera, la funda y el disco van donde diga `zones`: centro y
   * ancho en fracciones del lienzo, así el costado que queda libre es el del
   * panel de canciones. Cada tamaño de pantalla manda sus zonas — en compu son
   * tres columnas y en el teléfono la funda arriba y el vinilo abajo.
   *
   * `unit` es el ancho del objeto en unidades de escena: la funda mide AL de
   * lado, el disco dos radios.
   */
  _zonePose(name, unit) {
    const z = this._zones && this._zones[name];
    if (!z) return null;
    const w = this.clientWidth || this._w || 1, h = this.clientHeight || this._h || 1;
    const side = z.w * w;
    return this._screenPose({ x: z.cx * w - side / 2, y: z.cy * h - side / 2, w: side, h: side }, unit);
  }

  _screenPose(r, unit = AL) {
    const w = this.clientWidth || this._w || 1, h = this.clientHeight || this._h || 1;
    const cam = this._camera;
    cam.updateMatrixWorld();
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const dist = new THREE.Vector3(0, this._camTgtY, 0).sub(cam.position).dot(fwd);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const ray = new THREE.Vector3((cx / w) * 2 - 1, -(cy / h) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
    const p = cam.position.clone().addScaledVector(ray, dist / ray.dot(fwd));
    const worldPerPx = (2 * dist * Math.tan((FOV * DEG) / 2)) / h;
    return {
      x: p.x, y: p.y, z: p.z,
      rx: cam.rotation.x, ry: cam.rotation.y, rz: cam.rotation.z,
      s: (r.w * worldPerPx) / unit, o: 1,
    };
  }

  _camPose() {
    if (this._mode !== 'browse') return { dir: new THREE.Vector3(0, 0.03, 1).normalize(), tgtY: -0.34 };
    if (this._layout === 'row') return { dir: new THREE.Vector3(0, 0.13, 1).normalize(), tgtY: 0 };
    // Un poco desde arriba y de costado: se ven los lomos de la pila.
    // tgtY más arriba que el centro de la pila: abajo va el nombre del disco
    // con las flechas, y los últimos de la pila, casi transparentes, pueden
    // quedar debajo.
    return { dir: new THREE.Vector3(0.2, 0.28, 1).normalize(), tgtY: -0.25 };
  }

  _snapCamera() {
    this._resize();
    const pose = this._camPose();
    this._camDir.copy(pose.dir);
    this._camDist = this._dist();
    this._camTgtY = pose.tgtY;
    this._camera.position.copy(this._camDir).multiplyScalar(this._camDist);
    this._camera.lookAt(0, this._camTgtY, 0);
    this._camera.updateMatrixWorld();
  }

  // Pone la tapa cuando termina de bajar. Si falla (CORS, 404), la cara queda
  // del color liso de la funda.
  _cover(url, mat) {
    const apply = (tex) => {
      if (this._dead || !tex) return;
      mat.color.set(0xffffff);
      mat.map = tex;
      mat.emissive.set(0xffffff);
      mat.emissiveMap = tex;
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

    // Resplandor detrás del disco: lo que recorta su silueta contra el fondo.
    // Sólo con el vinilo afuera; guardado en la funda asomaría por los bordes.
    this._halo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    );
    // Bien atrás, no apenas detrás del disco: si queda casi en el mismo plano,
    // el halo llega hasta la funda y se ve como una sombra encima de la tapa.
    this._halo.position.z = -0.4;
    vg.add(this._halo);
    this._haloK = 0;

    // El mismo resplandor detrás de la funda abierta: sin él, con el vinilo
    // afuera la tapa quedaba sola sobre el negro y el conjunto no cerraba.
    // Vive en la escena, no en el grupo del vinilo, porque sigue a la funda.
    this._sleeveHalo = new THREE.Mesh(
      this._halo.geometry,
      new THREE.MeshBasicMaterial({ map: this._halo.material.map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    );
    this._scene.add(this._sleeveHalo);

    // El barniz queda oscuro, como el original: con reflejos de entorno y filo
    // claro el disco se veía plateado. El resplandor alcanza para recortarlo.
    this._grooveMat = new THREE.MeshPhysicalMaterial({
      map: grooveTexture([]), roughness: 0.26, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true,
    });
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: VINYL.edge, roughness: 0.4, clearcoat: 0.7, transparent: true });
    const backMat = edgeMat.clone();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(R_OUT, R_OUT, 0.016, 192, 1, false),
      [edgeMat, this._grooveMat, backMat]
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

    this._labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(this._accent(), '', '', '', LABEL_SIZE), roughness: 0.82, transparent: true });
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
    this._vinylMats = [this._grooveMat, edgeMat, backMat, this._labelMat, sheen.material];
    vg.scale.setScalar(0.2);
    vg.visible = false;
    this._vcur = { x: 0, y: 0, z: 0, s: 0.2, o: 0 };
  }

  _setBands() {
    const a = this._album();
    this._bands = makeBands(this._parse('tracks'));
    if (this._grooveMat.map) this._grooveMat.map.dispose();
    this._grooveMat.map = grooveTexture(this._bands);
    this._grooveMat.needsUpdate = true;
    if (this._labelMat.map) this._labelMat.map.dispose();
    this._labelMat.map = labelTexture(this._accent(), a.title, this._attr('artist') || '', a.year, LABEL_SIZE);
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

  /** Resaltar un surco desde afuera: lo usa el hover de la lista de canciones. */
  setHover(n) {
    if (this._up && !this._dead && this._mode === 'split') this._setHover(+n || 0);
  }

  _setHover(n) {
    if (n === this._hover) return;
    this._hover = n;
    // Para que la lista de canciones resalte el mismo tema que el surco.
    this.dispatchEvent(new CustomEvent('shelf-hover', { bubbles: true, composed: true, detail: { n } }));
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
          // En la pila manda el gesto vertical, como scrollear: arrastrar
          // hacia arriba trae los discos de abajo.
          const moved = this._layout === 'row' ? dx + dy * 0.6 : dy + dx * 0.4;
          this._cursor = clamp(d.cursor - moved / (this._layout === 'row' ? 110 : 90), 0, this._albums.length - 1);
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
      // Con el panel cortado por el borde de la ventana, la rueda es de la
      // página: si no, pasar por encima scrolleando te atrapa a mitad de camino.
      const box = this.getBoundingClientRect();
      if (box.top < -8 || box.bottom > window.innerHeight + 8) return;
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
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { this.step(1); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { this.step(-1); ev.preventDefault(); }
      // Sin discos no hay nada que abrir.
      if (last < 0) return;
      if (ev.key === 'Enter') { this._setMode('focus', Math.round(this._cursor)); ev.preventDefault(); }
    });
  }

  _target(i) {
    if (this._outro) {
      const r = this._outro[i];
      return r ? this._screenPose(r) : { x: 0, y: -2, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 0 };
    }
    const m = this._mode, d = i - this._cursor;
    if (m !== 'browse') {
      if (i !== this._focus) return { x: d < 0 ? -3.6 : 3.6, y: 0, z: -2.4, rx: 0, ry: 0, rz: 0, s: 0.9, o: 0 };
      if (m === 'focus') return { x: 0, y: 0, z: 0.55, rx: 0, ry: 0, rz: 0, s: 1.55, o: 1 };
      return this._zonePose('sleeve', AL) || { x: -0.74, y: 0, z: 0.5, rx: 0, ry: 0.17, rz: 0, s: 1.18, o: 1 };
    }
    if (this._layout === 'row') {
      return {
        x: d * 1.06, y: 0, z: -Math.abs(d) * 0.26, rx: 0, ry: -d * 0.085, rz: 0, s: 1,
        o: clamp(2.7 - Math.abs(d), 0, 1),
      };
    }
    /*
     * La pila vertical, como discos parados en un cajón visto desde arriba: el
     * de adelante casi derecho, los siguientes más abajo, más atrás y más
     * reclinados. Los que ya pasaste se levantan hacia arriba y se desvanecen,
     * como sacarlos del cajón. Continua en d = 0: arrastrando, el cursor pasa
     * por valores intermedios y no puede haber saltos.
     */
    if (d < 0) {
      return {
        x: 0, y: 0.18 - d * 0.95, z: -d * 0.35, rx: -0.12 - d * 0.7, ry: 0, rz: 0, s: 1,
        o: clamp(1 + d * 1.15, 0, 1),
      };
    }
    return {
      x: Math.min(d, 6) * 0.045, y: 0.18 - d * 0.24, z: -d * 0.36,
      rx: -0.12 - Math.min(d, 1) * 0.46, ry: 0, rz: 0, s: 1,
      o: clamp(2.4 - d * 0.42, 0, 1),
    };
  }

  /*
   * El vinilo espera guardado detrás de la funda abierta, para salir de ahí al
   * pasar a `split`. Pero la funda tarda en llegar al centro, y si el vinilo
   * aparecía apenas se abría, se lo veía asomar mientras ella todavía volaba.
   * Por eso en `focus` recién se hace visible con la funda ya en su lugar,
   * cuando queda tapado del todo (mide 0.46 de radio contra 0.62 de funda).
   */
  _sleeveSettled() {
    const it = this._items[this._focus];
    if (!it) return false;
    const tg = this._target(this._focus), c = it.cur;
    return c.o > 0.99 && Math.abs(tg.x - c.x) + Math.abs(tg.y - c.y) + Math.abs(tg.z - c.z) + Math.abs(tg.s - c.s) < 0.03;
  }

  _vinylTarget() {
    if (this._mode === 'split') {
      const zone = this._zonePose('vinyl', R_OUT * 2);
      return zone ? { x: zone.x, y: zone.y, z: zone.z, s: zone.s, o: 1 } : { x: 0.74, y: 0, z: 0.48, s: 0.48, o: 1 };
    }
    // Si ya estaba afuera (volviendo de `split`), sigue visible y se guarda
    // deslizándose detrás de la funda, en vez de desaparecer de golpe.
    if (this._mode === 'focus' && (this._vcur.o > 0.02 || this._sleeveSettled())) {
      return { x: 0, y: 0, z: 0.46, s: 0.46, o: 1 };
    }
    return { x: 0, y: 0, z: 0.2, s: 0.2, o: 0 };
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
      // La línea es la que une la etiqueta con su surco: sin etiqueta (hoy la
      // lista de canciones va al costado) no tiene de dónde salir.
      const l = this._lines[i];
      if (l) {
        l.setAttribute('x1', lx); l.setAttribute('y1', ly);
        l.setAttribute('x2', dx); l.setAttribute('y2', dy);
        l.setAttribute('opacity', on && el ? 0.5 : 0);
      }
    });
  }

  _loop = () => {
    // Fuera de pantalla el loop se corta solo; el IntersectionObserver lo
    // vuelve a arrancar.
    if (!this._onscreen) { this._raf = 0; return; }
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

    // El dedo en la pila mueve discos, no la página; con un disco abierto el
    // gesto vertical vuelve a ser scroll.
    const touch = this._mode === 'browse' ? 'none' : 'pan-y';
    if (this._renderer.domElement.style.touchAction !== touch) this._renderer.domElement.style.touchAction = touch;

    this._items.forEach((it, i) => {
      const c = it.cur;
      // Esperando su turno en la salida escalonada desde la grilla: quieta.
      if (!(it.hold && now < it.hold)) {
        const tg = this._target(i);
        const ki = it.hold || this._outro ? ease(6) : k;
        c.x += (tg.x - c.x) * ki; c.y += (tg.y - c.y) * ki; c.z += (tg.z - c.z) * ki;
        c.rx += (tg.rx - c.rx) * ki; c.ry += (tg.ry - c.ry) * ki; c.rz += (tg.rz - c.rz) * ki;
        c.s += (tg.s - c.s) * ki; c.o += (tg.o - c.o) * ki;
      }
      // Flotan: cada funda con su propia fase, nunca al unísono. Quietas
      // mientras van o vienen de la grilla, para calzar justo con la tapa 2D.
      const bob = this._outro || (it.hold && now < it.hold + 400) ? 0 : calm;
      it.g.position.set(c.x, c.y + Math.sin(t * 0.78 + i * 1.7) * 0.042 * bob, c.z);
      it.g.rotation.set(c.rx + Math.sin(t * 0.52 + i * 2.1) * 0.022 * bob, c.ry, c.rz + Math.sin(t * 0.63 + i) * 0.014 * bob);
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
    vc.x += (vt.x - vc.x) * k; vc.y += (vt.y - vc.y) * k; vc.z += (vt.z - vc.z) * k;
    vc.s += (vt.s - vc.s) * k; vc.o += (vt.o - vc.o) * k;
    // Lo mismo al cerrar: si se desvanecía de a poco, quedaba a la vista
    // cuando la funda se iba. Mientras no está afuera (`split`), se apaga ya.
    if (vt.o === 0 && this._mode !== 'split') { vc.o = 0; vc.x = vt.x; vc.y = vt.y; vc.z = vt.z; vc.s = vt.s; }
    this._vinyl.position.set(vc.x, vc.y + Math.sin(t * 0.7 + 0.9) * 0.03 * calm, vc.z);
    this._vinyl.rotation.set(Math.sin(t * 0.46) * 0.018 * calm, Math.sin(t * 0.38) * 0.03 * calm, 0);
    this._vinyl.scale.setScalar(vc.s);
    this._vinyl.visible = vc.o > 0.02;
    const vblend = vc.o < 0.995;
    this._vinylMats.forEach((m) => {
      m.opacity = vc.o;
      if (m.name !== 'sheen' && m.transparent !== vblend) { m.transparent = vblend; m.needsUpdate = true; }
    });
    this._sheen.rotation.z = t * 0.12;
    this._haloK += ((this._mode === 'split' ? 1 : 0) - this._haloK) * ease(5);
    this._halo.material.opacity = this._haloK * vc.o * HALO.stack;

    /*
     * El resplandor de la funda la sigue: se pone en su lugar, detrás de ella
     * (un paso en la dirección en la que mira la cámara) y con el tamaño que
     * le corresponde — el plano mide 2.9 y la funda AL, así que el 0.4 deja el
     * mismo halo alrededor que tiene el disco.
     */
    const open = this._items[this._focus];
    const sh = this._sleeveHalo;
    if (open) {
      const fwd = new THREE.Vector3();
      this._camera.getWorldDirection(fwd);
      sh.position.copy(open.g.position).addScaledVector(fwd, 0.35);
      sh.rotation.copy(this._camera.rotation);
      sh.scale.setScalar(open.cur.s * 0.4);
      sh.material.opacity = this._haloK * open.cur.o * HALO.stack * 0.85;
    } else sh.material.opacity = 0;
    sh.visible = sh.material.opacity > 0.01;

    const kg = ease(9.5);
    const rm = this._ring.material;
    rm.opacity += ((this._ringTarget || 0) * vc.o - rm.opacity) * kg;
    this._edges.forEach((e) => { e.material.opacity += ((this._edgeTarget || 0) * vc.o - e.material.opacity) * kg; });

    const pose = this._camPose();
    const kc = ease(4.5);
    this._camDir.lerp(pose.dir, kc);
    this._camDist += (this._dist() - this._camDist) * kc;
    this._camera.position.copy(this._camDir).normalize().multiplyScalar(this._camDist);
    // Con el disco abierto subo el encuadre: abajo va el nombre y el año.
    this._camTgtY += (pose.tgtY - this._camTgtY) * kc;
    this._camera.lookAt(0, this._camTgtY, 0);

    // Avisa qué disco quedó adelante, para mostrar su nombre abajo. Sólo
    // cuando cambia: el cursor se mueve en fracciones mientras se arrastra.
    const idx = Math.round(this._cursor);
    if (idx !== this._lastIdx) {
      this._lastIdx = idx;
      this.dispatchEvent(new CustomEvent('shelf-cursor', { bubbles: true, composed: true, detail: { index: idx } }));
    }

    this._renderer.render(this._scene, this._camera);
    this._place();
  };
}

if (!customElements.get('shelf-3d')) customElements.define('shelf-3d', Shelf3D);
