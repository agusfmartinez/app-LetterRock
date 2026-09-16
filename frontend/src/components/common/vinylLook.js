import * as THREE from 'three';

/*
 * Lo que comparten los dos vinilos 3D (`vinyl3d.js`, en la ficha del disco, y
 * `shelf3d.js`, en la pila): el sello y el resplandor.
 *
 * Un vinilo negro sobre la página casi negra no se veía — sólo flotaba el
 * sello naranja. Lo recorta un halo tibio detrás. Se probó también con
 * reflejos de entorno y un filo claro en el canto, pero el disco quedaba
 * plateado: el barniz se mantiene oscuro, como un vinilo de verdad.
 */

/*
 * Los colores del vinilo, en un solo lugar para los dos (pila y ficha del
 * disco). Para aclararlo u oscurecerlo, tocar acá y refrescar.
 *
 *  grooveCenter / grooveMid / grooveEdge — el color de fondo del disco, en un
 *    degradé del sello hacia el borde (centro más claro, borde más oscuro).
 *    Es lo que más cambia la claridad general.
 *  grooveLight — brillo de cada surco: base + variación (la variación hace las
 *    franjas finas que se ven al girar). Subirlo marca más los surcos.
 *  grooveShadow — la sombra entre surco y surco. Bajarla aclara y suaviza.
 *  trackGap — el aro liso que separa un tema del siguiente.
 *  edge — el canto y la cara de atrás del disco.
 */
export const VINYL = {
  grooveCenter: '#4f484a',
  grooveMid: '#413b3e',
  grooveEdge: '#5e585b',
  grooveLight: { base: 0.10, wave: 0.04 },
  grooveShadow: 0.85,
  trackGap: 0.2,
  edge: 0x262223,
};

/*
 * El resplandor de atrás, para los dos vinilos.
 *
 *  color — uno solo para los dos. Por defecto el acento del sitio.
 *  stack / turntable — cuánta fuerza tiene en cada vista. Van aparte porque
 *    con el mismo valor no se ven igual: en la pila el halo está de frente y
 *    entero, y en la ficha del disco está acostado en el piso, en perspectiva
 *    y medio tapado por el disco, así que rinde menos. 1 es la fuerza plena.
 */
export const HALO = {
  color: '#818181',
  stack: 0.65,
  turntable: 1,
};

export const HALO_COLOR = HALO.color;

/** Degradé radial tibio, transparente en el borde. Va en un plano detrás del disco. */
export function haloTexture(color = HALO_COLOR) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2;
  const grad = g.createRadialGradient(C, C, 0, C, C, C);
  const rgb = new THREE.Color(color);
  const col = (a) => `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},${a})`;
  // Lleno hasta donde tapa el disco, y de ahí se apaga: lo que se ve es un aura.
  grad.addColorStop(0, col(0.55));
  grad.addColorStop(0.65, col(0.42));
  grad.addColorStop(0.72, col(0.26));
  grad.addColorStop(1, col(0));
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Reparte palabras en `max` renglones parejos por cantidad de letras.
function balance(words, max) {
  if (words.length <= max) return words;
  const total = words.join(' ').length;
  const target = total / max;
  const lines = [];
  let line = '';
  words.forEach((w, i) => {
    const next = (line + ' ' + w).trim();
    const left = words.length - i;
    const slots = max - lines.length;
    if (line && next.length > target && slots > 1 && left >= slots - 1) {
      lines.push(line);
      line = w;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

/*
 * Ancho disponible en un renglón del sello: la cuerda del círculo a esa altura,
 * tomando el borde del texto más alejado del centro, con margen.
 */
function chord(u, yc, size) {
  const edge = Math.min(Math.abs(yc) + size * 0.42, u * 0.98);
  return 2 * Math.sqrt(u * u - edge * edge) * 0.84;
}

// Tamaño común para que todos los renglones entren en su cuerda.
function fit(g, lines, font, size, ys, u) {
  for (let pass = 0; pass < 3; pass++) {
    let next = size;
    lines.forEach((l, i) => {
      g.font = font(size);
      const w = g.measureText(l).width || 1;
      next = Math.min(next, size * (chord(u, ys(size)[i], size) / w));
    });
    if (next >= size - 0.5) break;
    size = next;
  }
  return size;
}

/**
 * El sello del vinilo. El artista va arriba del agujero con una palabra por
 * renglón ("LUIS / ALBERTO / SPINETTA"), a lo sumo tres; el disco, abajo, en
 * hasta dos renglones; el año al pie. Cada bloque se achica lo que haga falta
 * para entrar en el círculo, en vez de cortarse en el borde.
 */
export function labelTexture(accent, title, artist, year, S = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, u = C / 1.06;
  g.fillStyle = accent;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(20,18,17,0.32)'; g.lineWidth = S * 0.006;
  g.beginPath(); g.arc(C, C, u, 0, Math.PI * 2); g.stroke();

  g.save();
  g.translate(C, C);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1a1817';

  // — Artista: arriba del agujero, entre -0.82u y -0.17u —
  const words = String(artist || '').toUpperCase().split(/\s+/).filter(Boolean);
  const aLines = balance(words, 3);
  if (aLines.length) {
    const top = -u * 0.82, bottom = -u * 0.17;
    const n = aLines.length;
    const lineH = (bottom - top) / n;
    const artistFont = (s) => `${s}px Caprasimo, Georgia, serif`;
    // Los renglones van pegados al agujero: con uno o dos, quedan cerca del centro.
    const ys = (s) => aLines.map((_, i) => bottom - (n - i - 0.5) * Math.min(lineH, s * 1.02));
    const size = fit(g, aLines, artistFont, Math.min(u * 0.3, lineH / 1.02), ys, u);
    g.font = artistFont(size);
    const y = ys(size);
    aLines.forEach((l, i) => g.fillText(l, 0, y[i]));
  }

  // — Disco: abajo del agujero, hasta dos renglones —
  const titleFont = (s) => `600 ${s}px Figtree, system-ui, sans-serif`;
  let tSize = u * 0.135;
  g.font = titleFont(tSize);
  const maxW = chord(u, u * 0.42, tSize);
  const tWords = String(title || '').split(/\s+/).filter(Boolean);
  let tLines = [];
  let line = '';
  tWords.forEach((w) => {
    const next = (line + ' ' + w).trim();
    if (line && g.measureText(next).width > maxW) { tLines.push(line); line = w; } else line = next;
  });
  if (line) tLines.push(line);
  if (tLines.length > 2) tLines = [tLines[0], tLines.slice(1).join(' ')];
  if (tLines.length) {
    const tys = (s) => tLines.map((_, i) => u * 0.3 + i * s * 1.3);
    tSize = fit(g, tLines, titleFont, tSize, tys, u);
    g.font = titleFont(tSize);
    const y = tys(tSize);
    tLines.forEach((l, i) => g.fillText(l, 0, y[i]));
  }

  g.font = `${u * 0.1}px ui-monospace, monospace`;
  g.fillStyle = 'rgba(26,24,23,0.72)';
  g.fillText(String(year || ''), 0, u * 0.8);

  g.beginPath(); g.arc(0, 0, u * 0.085, 0, Math.PI * 2); g.fillStyle = '#0d0c0d'; g.fill();
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
