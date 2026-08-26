/**
 * Instrumentos y voces, como los nombra MusicBrainz, al castellano.
 *
 * La traducción va en la importación y no al mostrar: lo que queda en la base
 * es lo que se lee en pantalla. Si se guardara en inglés, el editor abriría el
 * formulario y vería "lead vocals" donde la página dice "voz", y cualquier
 * instrumento que agregara a mano quedaría en otro idioma que el resto.
 *
 * Lo que no está acá se guarda tal cual vino. Es preferible un "hurdy gurdy"
 * suelto a inventarle un nombre, y se corrige a mano desde el panel.
 */
const ROLE_ES = {
  'lead vocals': 'voz',
  'vocals': 'voz',
  'background vocals': 'coros',
  'spoken vocals': 'voz hablada',

  'guitar': 'guitarra',
  'electric guitar': 'guitarra eléctrica',
  'acoustic guitar': 'guitarra acústica',
  'classical guitar': 'guitarra criolla',
  'slide guitar': 'slide',
  'twelve string guitar': 'guitarra de doce cuerdas',

  'bass guitar': 'bajo',
  'electric bass guitar': 'bajo eléctrico',
  'acoustic bass guitar': 'bajo acústico',
  'double bass': 'contrabajo',

  'drums (drum set)': 'batería',
  'drums': 'batería',
  'electronic drum set': 'batería electrónica',
  'drum machine': 'caja de ritmos',
  'percussion': 'percusión',
  'membranophone': 'percusión',
  'congas': 'congas',
  'bongos': 'bongó',
  'timbales': 'timbales',

  'keyboard': 'teclados',
  'piano': 'piano',
  'electric piano': 'piano eléctrico',
  'organ': 'órgano',
  'hammond organ': 'órgano Hammond',
  'synthesizer': 'sintetizador',
  'mellotron': 'melotrón',
  'accordion': 'acordeón',

  'flute': 'flauta',
  'saxophone': 'saxo',
  'alto saxophone': 'saxo alto',
  'tenor saxophone': 'saxo tenor',
  'baritone saxophone': 'saxo barítono',
  'trumpet': 'trompeta',
  'trombone': 'trombón',
  'clarinet': 'clarinete',
  'harmonica': 'armónica',

  'violin': 'violín',
  'viola': 'viola',
  'cello': 'violonchelo',
  'strings': 'cuerdas',

  'mandolin': 'mandolina',
  'banjo': 'banjo',
  'charango': 'charango',
  'bandoneon': 'bandoneón',
  'ukulele': 'ukelele',
  'sitar': 'sitar',

  'programming': 'programación',
  'sampler': 'sampler',
  'theremin': 'theremin',
}

function translateRole(role) {
  return ROLE_ES[String(role).toLowerCase()] || role
}

module.exports = { translateRole, ROLE_ES }
