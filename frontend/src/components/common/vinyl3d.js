import * as THREE from 'three';

const R_OUT = 1.0, R_PLAY_OUT = 0.955, R_PLAY_IN = 0.335, R_LABEL = 0.3;
const ARM = { x: 1.02, z: 1.02, len: 1.12 };
const DEG = Math.PI / 180;

const secs = (d) => { const p = String(d || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };

// Reparte los surcos por duración real: el track 1 ocupa el borde exterior.
function bands(tracks) {
  const total = tracks.reduce((a, t) => a + secs(t.dur), 0) || 1;
  const span = R_PLAY_OUT - R_PLAY_IN;
  let cum = 0;
  return tracks.map((t) => {
    const a = cum; cum += secs(t.dur);
    return {
      n: t.n, title: t.title, dur: t.dur,
      rOut: R_PLAY_OUT - (a / total) * span,
      rIn: R_PLAY_OUT - (cum / total) * span,
    };
  }).map((b) => ({ ...b, rMid: (b.rIn + b.rOut) / 2 }));
}

// Ángulos de anclaje: primera mitad a la izquierda, segunda a la derecha.
function anchorAngle(i, n) {
  const half = Math.ceil(n / 2);
  if (i < half) return (146 + (half > 1 ? (i / (half - 1)) * 66 : 0)) * DEG;
  const j = i - half, m = n - half;
  return (34 - (m > 1 ? (j / (m - 1)) * 68 : 0)) * DEG;
}

function grooveTexture(bs, accent, title, artist, year) {
  const S = 2048, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, px = (r) => r * C;
  g.fillStyle = '#0b0a0b'; g.fillRect(0, 0, S, S);

  const grad = g.createRadialGradient(C, C, px(0.3), C, C, px(1));
  grad.addColorStop(0, '#242124'); grad.addColorStop(0.55, '#141315'); grad.addColorStop(1, '#0a0a0b');
  g.fillStyle = grad; g.beginPath(); g.arc(C, C, px(R_OUT), 0, Math.PI * 2); g.fill();

  g.lineWidth = 1;
  for (let r = R_LABEL; r < R_OUT; r += 0.0016) {
    const t = (r - R_LABEL) / (R_OUT - R_LABEL);
    g.strokeStyle = `rgba(255,252,246,${0.05 + 0.05 * Math.sin(t * 140)})`;
    g.beginPath(); g.arc(C, C, px(r), 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.arc(C, C, px(r + 0.0008), 0, Math.PI * 2); g.stroke();
  }

  // Separación lisa entre tracks, como en un disco real.
  bs.forEach((b) => {
    g.strokeStyle = 'rgba(255,250,242,0.2)'; g.lineWidth = 5;
    g.beginPath(); g.arc(C, C, px(b.rIn), 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(C, C, px(b.rIn - 0.004), 0, Math.PI * 2); g.stroke();
  });

  g.strokeStyle = 'rgba(255,250,242,0.16)'; g.lineWidth = 5;
  g.beginPath(); g.arc(C, C, px(R_PLAY_OUT + 0.014), 0, Math.PI * 2); g.stroke();

  g.fillStyle = '#0e0d0e';
  g.beginPath(); g.arc(C, C, px(R_LABEL + 0.006), 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// El sello no gira con el disco: el texto tiene que quedar legible.
function labelTexture(accent, title, artist, year) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, u = C / 1.06;
  g.fillStyle = accent;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(20,18,17,0.32)'; g.lineWidth = 6;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(C, C); g.textAlign = 'center'; g.fillStyle = '#1a1817';
  g.font = `${u * 0.3}px Caprasimo, Georgia, serif`;
  g.fillText(String(artist || '').toUpperCase(), 0, -u * 0.3);
  g.font = `600 ${u * 0.135}px Figtree, system-ui, sans-serif`;
  const words = String(title || '').split(' ');
  const lines = []; let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > 18) { lines.push(line.trim()); line = w; } else line += ' ' + w;
  });
  if (line.trim()) lines.push(line.trim());
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 0, u * 0.32 + i * u * 0.185));
  g.font = `${u * 0.105}px ui-monospace, monospace`;
  g.fillStyle = 'rgba(26,24,23,0.72)';
  g.fillText(String(year || ''), 0, u * 0.82);
  g.beginPath(); g.arc(0, 0, u * 0.085, 0, Math.PI * 2); g.fillStyle = '#0d0c0d'; g.fill();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sheenTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2;
  const cone = g.createConicGradient ? g.createConicGradient(0, C, C) : null;
  if (cone) {
    [[0, 'rgba(0,0,0,0)'], [0.055, 'rgba(255,246,228,0.16)'], [0.13, 'rgba(0,0,0,0)'],
     [0.47, 'rgba(0,0,0,0)'], [0.53, 'rgba(255,246,228,0.08)'], [0.6, 'rgba(0,0,0,0)'],
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

class Vinyl3D extends HTMLElement {
  static get observedAttributes() { return ['active', 'tracks', 'accent']; }

  connectedCallback() {
    if (this._up) return;
    this._up = true;
    this.style.position = 'relative';
    this.style.display = 'block';
    this._root = this.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = ':host{position:relative;display:block;width:100%;height:100%}canvas{position:absolute;inset:0;width:100%;height:100%}' +
      'svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}' +
      '.labels{position:absolute;inset:0;pointer-events:none}';
    this._root.appendChild(st);
    this._tracks = this._parse();
    this._bands = bands(this._tracks);
    this._active = +this._attr('active') || 0;
    this._hover = 0;
    this._spin = 0;
    this._spinBoost = 0;
    this._targetArm = 0;
    this._build();
    document.fonts.ready.then(() => this._retexture());
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._renderer) this._renderer.dispose();
  }

  attributeChangedCallback(name, old, val) {
    if (!this._up || old === val) return;
    if (name === 'active') { this._active = +val || 0; this._syncActive(); }
    if (name === 'tracks') {
      this._tracks = this._parse();
      this._bands = bands(this._tracks);
      this._rebuildAnchors();
      this._retexture();
      this._syncActive();
    }
    if (name === 'accent') this._retexture();
  }

  // Formato compacto sin escapes: "1|La rubia tarada|3:02;2|Kaya|4:12"
  _parse() {
    const raw = (this._attr('tracks') || '').trim();
    if (!raw) return [];
    if (raw[0] === '[') { try { return JSON.parse(raw); } catch (e) { return []; } }
    return raw.split(';').filter(Boolean).map((row, i) => {
      const [n, title, dur] = row.split('|');
      return { n: +n || i + 1, title: (title || '').trim(), dur: (dur || '3:00').trim() };
    });
  }

  // x-import puede entregar los atributos en kebab o camel: acepto los dos.
  _attr(name) {
    const camel = name.replace(/-([a-z])/g, (m, c) => c.toUpperCase()).toLowerCase();
    return this.getAttribute(name) ?? this.getAttribute(camel);
  }

  _accent() { return this._attr('accent') || '#c67139'; }

  _build() {
    if (!this.clientHeight) this.style.height = (this._attr('height') || 560) + 'px';
    const w = this.clientWidth || 640, h = this.clientHeight || 560;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    this._root.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this._scene = scene;
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 60);
    camera.position.set(0, 2.55, 3.2);
    this._camera = camera;

    this._fit();

    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x1a1718, 0.34));
    const key = new THREE.DirectionalLight(0xfff6e6, 1.75);
    key.position.set(-2.6, 4.2, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -2.4;
    key.shadow.camera.right = key.shadow.camera.top = 2.4;
    key.shadow.radius = 5;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf4e6d2, 0.85);
    rim.position.set(3.1, 2.2, -2.6);
    scene.add(rim);
    scene.add(new THREE.PointLight(0xffe9c8, 1.4, 9, 2).translateY(2.4));

    const disc = new THREE.Group();
    disc.name = 'vinyl';
    scene.add(disc);
    this._disc = disc;

    this._grooveMat = new THREE.MeshPhysicalMaterial({
      map: grooveTexture(this._bands, this._accent(), this._attr('label-title'),
        this._attr('label-artist'), this._attr('label-year')),
      roughness: 0.26, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x121112, roughness: 0.4, clearcoat: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT, R_OUT, 0.018, 256, 1, false),
      [edgeMat, this._grooveMat, edgeMat]);
    body.name = 'disc';
    body.castShadow = true; body.receiveShadow = true;
    disc.add(body);
    this._pick = body;

    const sheen = new THREE.Mesh(
      new THREE.RingGeometry(R_LABEL + 0.012, R_OUT * 0.995, 128, 1),
      new THREE.MeshBasicMaterial({ map: sheenTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sheen.name = 'sheen';
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.y = 0.0105;
    disc.add(sheen);
    this._sheen = sheen;

    // Anillo de brillo del track activo — no gira con el disco.
    const anchors = new THREE.Group();
    scene.add(anchors);
    this._anchors = anchors;

    this._labelMat = new THREE.MeshStandardMaterial({
      map: labelTexture(this._accent(), this._attr('label-title'), this._attr('label-artist'), this._attr('label-year')),
      roughness: 0.82, metalness: 0,
    });
    const sello = new THREE.Mesh(new THREE.CircleGeometry(R_LABEL + 0.004, 96), this._labelMat);
    sello.name = 'label';
    sello.rotation.x = -Math.PI / 2;
    sello.position.y = 0.0115;
    anchors.add(sello);

    const glowMat = (op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(this._accent()), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this._ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 192), glowMat());
    this._ring.name = 'trackGlow';
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.y = 0.013;
    anchors.add(this._ring);

    this._edges = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.51, 192), glowMat());
      m.name = 'trackEdge';
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.0135;
      anchors.add(m);
      return m;
    });

    this._dots = this._makeDots();

    // Brazo: la púa se posa en el surco del track activo.
    const arm = new THREE.Group();
    const armMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.35, metalness: 0.75 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, ARM.len - 0.06, 20), armMat);
    tube.rotation.z = Math.PI / 2; tube.position.set(-(ARM.len - 0.06) / 2, 0, 0);
    arm.add(tube);
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.16, 24),
      new THREE.MeshStandardMaterial({ color: 0x3c3630, roughness: 0.55, metalness: 0.4 }));
    pivot.position.y = -0.02;
    arm.add(pivot);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.05, 28),
      new THREE.MeshStandardMaterial({ color: 0x2a251f, roughness: 0.7 }));
    base.position.y = -0.12;
    arm.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.5 }));
    head.position.set(-ARM.len, -0.035, 0);
    arm.add(head);
    arm.position.set(ARM.x, 0.15, ARM.z);
    arm.rotation.y = this._armAngle(R_OUT + 0.24);
    arm.traverse((o) => { o.castShadow = true; });
    scene.add(arm);
    this._arm = arm;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.ShadowMaterial({ opacity: 0.16 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.075;
    shadow.receiveShadow = true;
    scene.add(shadow);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._root.appendChild(svg);
    const wrap = document.createElement('div');
    wrap.className = 'labels';
    wrap.appendChild(document.createElement('slot'));
    this._root.appendChild(wrap);
    this._svg = svg;
    this._lines = this._makeLines();

    this._ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (ev) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this._ray.setFromCamera(ndc, camera);
      const is = this._ray.intersectObject(this._pick, false);
      if (!is.length) return 0;
      const p = this._pick.worldToLocal(is[0].point.clone());
      const rad = Math.hypot(p.x, p.z);
      const b = this._bands.find((bb) => rad <= bb.rOut + 0.004 && rad >= bb.rIn - 0.004);
      return b ? b.n : 0;
    };
    renderer.domElement.addEventListener('pointermove', (ev) => {
      const n = hit(ev);
      renderer.domElement.style.cursor = n ? 'pointer' : 'default';
      this._setHover(n);
    });
    renderer.domElement.addEventListener('pointerleave', () => {
      // Retardo corto: da tiempo a que el puntero llegue a la etiqueta HTML.
      clearTimeout(this._hoverOff);
      this._hoverOff = setTimeout(() => this._setHover(0), 140);
    });
    renderer.domElement.addEventListener('click', (ev) => {
      const n = hit(ev);
      if (n) this.dispatchEvent(new CustomEvent('vinyl-select', { bubbles: true, detail: { n } }));
    });

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);

    this._syncActive();
    this._loop();
  }

  _setHover(n) {
    clearTimeout(this._hoverOff);
    if (n === this._hover) return;
    this._hover = n;
    this.dispatchEvent(new CustomEvent('vinyl-hover', { bubbles: true, detail: { n } }));
  }

  _rebuildAnchors() {
    if (!this._anchors) return;
    this._dots.forEach((d) => { this._anchors.remove(d); d.geometry.dispose(); d.material.dispose(); });
    this._lines.forEach((l) => l.remove());
    this._dots = this._makeDots();
    this._lines = this._makeLines();
  }

  _makeDots() {
    return this._bands.map((b, i) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0xbdb3a2 }));
      const a = anchorAngle(i, this._bands.length);
      dot.position.set(Math.cos(a) * b.rMid, 0.02, -Math.sin(a) * b.rMid);
      dot.userData = { n: b.n, angle: a, r: b.rMid };
      this._anchors.add(dot);
      return dot;
    });
  }

  _makeLines() {
    return this._bands.map(() => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('stroke', 'currentColor');
      l.setAttribute('stroke-width', '1');
      l.setAttribute('opacity', '0.4');
      this._svg.appendChild(l);
      return l;
    });
  }

  _retexture() {
    if (!this._grooveMat) return;
    if (this._grooveMat.map) this._grooveMat.map.dispose();
    this._grooveMat.map = grooveTexture(this._bands, this._accent(), this._attr('label-title'),
      this._attr('label-artist'), this._attr('label-year'));
    this._grooveMat.needsUpdate = true;
    if (this._labelMat) {
      if (this._labelMat.map) this._labelMat.map.dispose();
      this._labelMat.map = labelTexture(this._accent(), this._attr('label-title'),
        this._attr('label-artist'), this._attr('label-year'));
      this._labelMat.needsUpdate = true;
    }
    if (this._ring) {
      this._ring.material.color = new THREE.Color(this._accent());
      this._edges.forEach((e) => { e.material.color = new THREE.Color(this._accent()); });
    }
  }

  _syncActive() {
    const b = this._bands.find((x) => x.n === this._active);
    if (b && this._ring) {
      this._ring.geometry.dispose();
      this._ring.geometry = new THREE.RingGeometry(b.rIn + 0.006, b.rOut - 0.006, 192);
      this._edges[0].geometry.dispose();
      this._edges[0].geometry = new THREE.RingGeometry(b.rOut - 0.012, b.rOut - 0.002, 192);
      this._edges[1].geometry.dispose();
      this._edges[1].geometry = new THREE.RingGeometry(b.rIn + 0.002, b.rIn + 0.012, 192);
      this._ringTarget = 0.13;
      this._edgeTarget = 0.8;
      this._targetArm = b.rMid;
      this._spinBoost = 1;
    } else {
      this._ringTarget = 0;
      this._edgeTarget = 0;
      this._targetArm = 0;
    }
    this._dots.forEach((d) => d.material.color.set(d.userData.n === this._active ? this._accent() : 0xbdb3a2));
  }

  // La púa se posa sobre el radio del track: ángulo por ley de cosenos.
  _armAngle(r) {
    const d = Math.hypot(ARM.x, ARM.z), L = ARM.len;
    const alpha = Math.atan2(-ARM.z, -ARM.x);
    const cos = Math.max(-1, Math.min(1, (d * d + L * L - r * r) / (2 * d * L)));
    return Math.PI - (alpha - Math.acos(cos));
  }

  // El disco (radio 1) más el brazo (x≈1.02) tienen que entrar completos:
  // la cámara mantiene su dirección y sólo se aleja lo necesario según el aspecto.
  _fit() {
    const cam = this._camera;
    if (!cam) return;
    const need = 1.34;
    const halfH = Math.tan((cam.fov * DEG) / 2);
    const halfW = halfH * cam.aspect;
    const dist = Math.max(need / halfW, (need * 0.8) / halfH) * 1.04;
    cam.position.copy(new THREE.Vector3(0, 2.55, 3.2).normalize().multiplyScalar(Math.max(dist, 3.4)));
    cam.lookAt(0, 0, 0);
  }

  // El CSS del shadow estira el canvas al 100%, así que el buffer se
  // sincroniza siempre desde el tamaño vivo del host.
  _resize() {
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h || (w === this._w && h === this._h)) return;
    this._w = w; this._h = h;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._fit();
  }

  _place() {
    const r = this.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const v = new THREE.Vector3();
    this._dots.forEach((dot, i) => {
      dot.getWorldPosition(v).project(this._camera);
      const dx = (v.x * 0.5 + 0.5) * r.width, dy = (-v.y * 0.5 + 0.5) * r.height;
      const a = dot.userData.angle;
      const out = new THREE.Vector3(Math.cos(a) * 1.16, 0.02, -Math.sin(a) * 1.16).project(this._camera);
      const lx = (out.x * 0.5 + 0.5) * r.width, ly = (-out.y * 0.5 + 0.5) * r.height;
      const el = this.querySelector(`[data-track-anchor="${dot.userData.n}"]`);
      const n = dot.userData.n;
      const show = n === this._active || n === this._hover;
      const left = Math.cos(a) < 0;
      let cx = lx;
      if (el) {
        const bw = el.offsetWidth || 122;
        cx = Math.max(left ? bw + 8 : 8, Math.min(lx, left ? r.width - 8 : r.width - bw - 8));
        el.style.position = 'absolute';
        el.style.left = cx + 'px';
        el.style.top = ly + 'px';
        el.style.transform = `translate(${left ? '-100%' : '0'},-50%)`;
        el.style.textAlign = left ? 'right' : 'left';
        el.style.opacity = show ? '1' : '0';
        el.style.pointerEvents = show ? 'auto' : 'none';
        el.style.transition = 'opacity .16s ease';
        if (!el._vHover) {
          el._vHover = true;
          el.addEventListener('pointerenter', () => this._setHover(n));
          el.addEventListener('pointerleave', () => {
            clearTimeout(this._hoverOff);
            this._hoverOff = setTimeout(() => this._setHover(0), 140);
          });
        }
      }
      const l = this._lines[i];
      l.setAttribute('x1', cx); l.setAttribute('y1', ly);
      l.setAttribute('x2', dx); l.setAttribute('y2', dy);
      l.setAttribute('opacity', show ? (n === this._active ? 0.8 : 0.45) : 0);
    });
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    this._resize();
    this._disc.rotation.y = 0;
    const m = this._ring.material;
    m.opacity += ((this._ringTarget ?? 0) - m.opacity) * 0.12;
    this._edges.forEach((e) => { e.material.opacity += ((this._edgeTarget ?? 0) - e.material.opacity) * 0.12; });
    this._arm.rotation.y += (this._armAngle(this._targetArm || R_OUT + 0.24) - this._arm.rotation.y) * 0.07;
    this._renderer.render(this._scene, this._camera);
    this._place();
  };
}

if (!customElements.get('vinyl-3d')) customElements.define('vinyl-3d', Vinyl3D);
