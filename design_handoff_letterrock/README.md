# Handoff: LetterRock — frontend completo (22 rutas + estados + mobile)

## Qué es esto

Las maquetas de `design_handoff_letterrock/LetterRock.dc.html` son **referencias de diseño hechas en HTML**: muestran layout, jerarquía, copy real e interacciones previstas. **No son código para copiar y pegar** al repo.

La tarea es **recrear estas pantallas en `frontend/`** con lo que ya existe ahí: React 18 + Vite, Tailwind (tokens `rock.*` ya definidos en `tailwind.config.js`), React Router, Zustand (`store/authStore.ts`, `store/uiStore.ts`) y los hooks de datos de `src/hooks/`. Ninguna pantalla necesita librerías nuevas, con una excepción: el vinilo 3D necesita `three` (ver *Assets*).

## Fidelidad

**Alta (hifi)** en layout, tipografía relativa, espaciado, copy y comportamiento — recrear con precisión.
**Baja en color:** ver la decisión abierta abajo.

## ⚠️ Decisión abierta: la paleta

Las maquetas están sobre el sistema **Organic** (fondo crema `#f5ead8`, tinta `#201e1d`, acento terracota `#c67139`, sage `#7a8a5e`, Caprasimo + Figtree).
El repo está sobre el tema **rock oscuro** (`rock.dark #100d0b`, `rock.text #efe8e1`, `rock.accent #c1592c`, Oswald + Manrope).

Son dos temas distintos, no un error. Elegir uno antes de portar:

- **Opción A — mantener el repo oscuro (recomendado por defecto).** Portar solo estructura, espaciado, jerarquía, copy y comportamiento. Cada color de la maqueta se traduce con la tabla de *Design tokens*. Es el camino con menos trabajo y no rompe las pantallas ya construidas.
- **Opción B — pasar el repo a Organic.** Reemplazar los tokens `rock.*` en `tailwind.config.js` por los de Organic y las fuentes en `index.css`. Toca toda la app; solo tiene sentido si se quiere el cambio de identidad completo.

Las medidas, radios y sombras de este documento describen las maquetas (Organic). En la opción A, mantener las **proporciones** y usar los radios/sombras del repo.

## Mapa pantalla → archivo del repo

| Maqueta (`data-screen-label`) | Archivo destino | Hook / dato |
| --- | --- | --- |
| Home | `pages/Home.jsx` | `useActivityFeed`, `useCollections` |
| Banda | `pages/ArtistDetail.jsx` | `useArtist`, `useArtistMembers`, `useFollows`, `useFavorite` |
| Album (+ track) | `pages/AlbumDetail.jsx`, `pages/TrackDetail.jsx` | `useReviews`, `useComments`, `useTopTracks`, `useFavorite` |
| Colecciones | `pages/Collections.jsx` | `useCollections` |
| Coleccion timeline | `pages/CollectionDetail.jsx` | `useCollections` |
| Coleccion seccion | `pages/CollectionSection.jsx` | `useReviews`, `useComments` |
| Coleccion plana (ranking / lista) | `pages/CollectionDetail.jsx` (variante) | `useCollections` |
| Busqueda | `pages/Search.jsx` | `services/search.ts` |
| Auth (login / registro) | `pages/AuthPages.jsx` | `useAuth`, `authStore` |
| Perfil | `pages/Profile.jsx` | `useAuth`, `useFollows`, `usePosts` |
| Bienvenida (onboarding, 2 pasos) | `pages/Onboarding.jsx` | `useOnboarding`, `useFollows` |
| Usuarios / Gente | `pages/Users.jsx` | `useFollows` |
| Musico | `pages/MemberDetail.jsx` | `useArtistMembers` |
| Admin (panel) | `pages/AdminDiscover.jsx`, `AdminCollections.jsx`, `AdminArtists.jsx`, `AdminUsers.jsx` | `useCatalogAdmin`, `useRole` |
| Editar coleccion | `pages/AdminCollectionEdit.jsx` | `useCollectionAdmin` |
| Editar epoca | `pages/AdminSectionEdit.jsx` | `useCollectionAdmin` |
| Editar artista | `pages/AdminArtistEdit.jsx` | `useCatalogAdmin` |
| Editar disco | `pages/AdminAlbumEdit.jsx` | `useCatalogAdmin` |
| Legal (privacidad / términos) | `pages/Legal.jsx` | — |
| 404 | `pages/NotFound.jsx` | — |
| Spotify | `pages/SpotifyCallback.jsx` | `services/spotifyAuth.ts` |
| **Estados** | no es una ruta — sistema | ver *Estados* |
| **Mobile** | no es una ruta — sistema | ver *Mobile* |

Para ver una pantalla en la maqueta: abrir `LetterRock.dc.html` y navegar con la barra superior; `Estados` y `Mobile` están al final del menú.

## Estados de carga, vacío y error

Un sistema transversal, no una pantalla. La maqueta `Estados` los muestra los tres en vivo.

**Carga — esqueletos, nunca "Cargando…".** El esqueleto conserva la forma de lo que viene, en cuatro tipos:
- *ficha*: bloque cuadrado + 3 renglones (detalle de disco/banda)
- *grilla*: N tarjetas iguales (colecciones, resultados)
- *filas*: 5–6 renglones de alto uniforme (tracklist, actividad, tablas admin)
- *panel*: 2 columnas de campos (formularios admin)

El repo ya tiene la clase `.skeleton` en `index.css` (shimmer 1.6s, `animate-shimmer`) — usarla; no crear otra.

**Vacío — sin ilustración ni decoración.** Título corto, una línea de explicación, y un CTA directo cuando la acción existe. Ejemplos de copy usados: "Todavía no seguís a nadie" / "Seguí gente para ver qué está escuchando" / botón "Buscar gente". Cuando no hay acción posible, solo la línea de explicación.

**Error — alerta en terracota** (`rock.accent` en la opción A), texto completo sobre fondo tintado al 10–12%, radio del contenedor, y un botón "Reintentar" que vuelve a disparar el hook. Nunca un `alert()` ni un toast que desaparezca.

Regla: cada pantalla que lee datos implementa los tres. El orden es `isLoading → error → empty → data`.

## Mobile

La maqueta `Mobile` muestra cuatro iPhones de referencia. Reglas, en orden de importancia:

1. **Barra de solapas abajo** reemplaza la hamburguesa: Home · Bandas · Colecciones · Buscar · Perfil. Fija, con `safe-area-inset-bottom`. Buscar sale del header y pasa a la barra.
2. **El vinilo no se achica ni se rota.** Rompe el borde izquierdo mostrando ~dos tercios; el resto se corta fuera del viewport.
3. **Solapas con scroll horizontal** (perfil, admin, legal): fila scrolleable sin barra visible, sin envolver a dos líneas.
4. **Formularios de dos columnas se apilan** a una sola; los controles suben a **48px** de alto para touch (en desktop quedan como están).
5. Breakpoint: `md` (768px) de Tailwind. Todo lo de arriba es el estado `< md`.

## Interacciones

- **Navegación**: React Router; cada `onClick` de la maqueta corresponde a un `<Link>` o `navigate()`. Los "← Volver" van a la entidad padre, no a `history.back()`.
- **Vinilo ↔ tracklist**: un solo `activeTrack` gobierna los dos. Hover sobre un surco resalta el renglón y viceversa; en la ruta de track, el track seleccionado queda fijado. Flechas ← → mueven la selección con wrap.
- **Follow / favorito**: optimista — el botón cambia de estado antes de la respuesta y revierte si falla.
- **Formularios admin**: validación al submit, no al tipear; el error se muestra bajo el campo.
- **Transiciones**: 200ms ease sobre color/background/border/opacity/transform (ya está en `index.css`). `animate-fade-up` (0.5s) al entrar contenido nuevo.
- **Foco de teclado**: outline 2px acento, ya global en `index.css`. No pisarlo por componente.

## Estado

Lo que ya existe alcanza: `authStore` (sesión + rol para las rutas admin), `uiStore` (UI global), y los hooks de `src/hooks/` para datos. Lo nuevo que hace falta:
- `activeTrack` local en la pantalla de disco (número de track o `null`).
- Paso de onboarding (`'artists' | 'people'`) local en `Onboarding.jsx`.
- Solapa activa local en perfil, admin y legal.
- Estado de la barra de solapas mobile: derivado de la ruta, no guardado.

## Design tokens

**Traducción Organic → repo (para la opción A):**

| Rol | Organic (maqueta) | Repo (`rock.*`) |
| --- | --- | --- |
| Fondo | `#f5ead8` | `rock.dark` `#100d0b` |
| Superficie / tarjeta | `--color-neutral-100` | `rock.card` `#1b1613` |
| Borde | `--color-neutral-200` | `rock.border` `#332720` |
| Borde fuerte | `--color-neutral-300` | `rock.borderStrong` `#4a382c` |
| Texto | `#201e1d` | `rock.text` `#efe8e1` |
| Texto secundario | `--color-neutral-700` | `gray.400` `#a89a8d` |
| Acento | `#c67139` | `rock.accent` `#c1592c` |
| Acento hover | `--color-accent-600` | `rock.accentBright` `#e07a45` |
| Acento tenue / fondo tintado | `--color-accent-100` | `rock.accentDim` `#7a3a1f` |
| Segundo acento (sage) | `#7a8a5e` | *no existe en el repo* — agregar si se quiere la segunda voz, o resolver con `gray.500` |

**Tipografía.** Maqueta: Caprasimo (display) + Figtree (body). Repo: Oswald (display) + Manrope (body) + JetBrains Mono. En la opción A se usa el par del repo. Escala de títulos en la maqueta: `clamp(36px, 4.8vw, 58px)` para h1 de pantalla, `line-height: 0.96–0.98`, `letter-spacing: -0.03em`. Kickers: 10.5–12px, `letter-spacing: 0.14–0.16em`, mayúsculas. Body 13.5–16px. Ancho de lectura `52–62ch`.

**Espaciado.** Padding vertical de pantalla `54px 0 40px`; gaps de sección 26–52px; gap de grilla 36–48px. Radios en la maqueta: 28–34px en contenedores grandes, 999px en botones e inputs (Organic es deliberadamente redondeado — el repo usa radios chicos; en la opción A mantener los del repo).

**Sombras.** `shadow-card` / `shadow-card-hover` / `shadow-glow` del repo, ya tintadas con el acento.

## Assets

- **`vinyl3d.js`** — el vinilo 3D, incluido en este paquete. Módulo ES que importa `three` como bare specifier, así que en el repo funciona tal cual: `npm i three`, copiarlo a `src/components/common/vinyl3d.js` y montarlo desde un componente React con un `useEffect` (crear en el mount, hacer `dispose` en el cleanup). Genera los surcos por duración real de cada track y dibuja la etiqueta central en canvas — no necesita imágenes.
- **Tapas de disco y fotos**: en las maquetas son placeholders a rayas. Van las imágenes reales vía `services/storage.ts`. Envolverlas con esquinas redondeadas y el tratamiento lavado si se va por la opción B.
- **Iconos**: Lucide, stroke-width 2.75 en las maquetas. Si el repo ya tiene un set de iconos, usar ese.
- **`ios-frame.jsx`** — solo para ver las maquetas mobile en este paquete. **No va al repo.**

## Archivos de este paquete

- `LetterRock.dc.html` — todas las pantallas. Fuente de verdad para layout exacto y copy. Es el archivo del proyecto de diseño: para verlo funcionando, abrirlo desde ahí (fuera del proyecto le faltan la hoja de tokens y el runtime). Para leer markup, estilos y copy exactos alcanza con abrirlo como texto.
- `vinyl3d.js` — portable al repo tal cual (ver *Assets*).
- `ios-frame.jsx` — soporte de la maqueta mobile; no portar.
- `organic.css` — la hoja de tokens de Organic, por si se va por la opción B.
