const fs = require('fs');
const path = require('path');

// ============ CONFIG ============
const CARPETA_IMAGENES = path.join(__dirname, 'imagenes extr');
const CARPETA_DESTINO = path.join(__dirname, 'img', 'productos');

// Categorías y subcategorías
const CATS = {
  suplementos: 'suplementos',
  belleza: 'belleza-y-bienestar',
  salud: 'salud-y-bienestar',
  vitaminas: 'vitaminas-y-minerales'
};

const SUBS = {
  'complejo-b': { key: 'suplementos_complejo-b', label: 'Complejo B', cat: 'suplementos' },
  'salud-sanguinea': { key: 'suplementos_salud-sanguinea', label: 'Salud sanguínea', cat: 'suplementos' },
  'antioxidantes': { key: 'vitaminas_antioxidantes', label: 'Antioxidantes', cat: 'vitaminas' },
  'limpieza-intestinal': { key: 'salud_limpieza-intestinal', label: 'Limpieza intestinal', cat: 'salud' },
  'sistema-inmunologico': { key: 'suplementos_sistema-inmunologico', label: 'Sistema inmunológico', cat: 'suplementos' },
  'calendula': { key: 'belleza_calendula', label: 'Calendula', cat: 'belleza' },
  'colageno': { key: 'belleza_colageno', label: 'Colageno', cat: 'belleza' },
  'potencia-masculina': { key: 'suplementos_potencia-masculina', label: 'Potencia Masculina', cat: 'suplementos' },
  'rinones': { key: 'salud_rinones', label: 'Riñones y vías urinarias', cat: 'salud' },
  'gastritis': { key: 'salud_gastritis', label: 'Gastritis y acidez', cat: 'salud' },
  'glucosamina': { key: 'belleza_glucosamina', label: 'Glucosamina', cat: 'belleza' },
  'balance-hormonal': { key: 'suplementos_balance-hormonal', label: 'Balance hormonal', cat: 'suplementos' },
  'perdida-de-peso': { key: 'suplementos_perdida-de-peso', label: 'Pérdida de peso', cat: 'suplementos' },
  'magnesio': { key: 'vitaminas_magnesio', label: 'Magnecio', cat: 'vitaminas' },
  'vitamina-e': { key: 'vitaminas_vitamina-e', label: 'Vitamina E', cat: 'vitaminas' },
  'calcio': { key: 'vitaminas_calcio', label: 'Calcio', cat: 'vitaminas' },
  'creatina': { key: 'suplementos_creatina', label: 'Creatina', cat: 'suplementos' },
  'proteina': { key: 'suplementos_proteina', label: 'Proteina', cat: 'suplementos' },
  'vitamina-c': { key: 'vitaminas_vitamina-c', label: 'Vitamina C', cat: 'vitaminas' },
  'desparasitacion': { key: 'salud_desparasitacion', label: 'Desparasitación', cat: 'salud' },
  'resveratrol': { key: 'suplementos_resveratrol', label: 'Resveratrol', cat: 'suplementos' },
  'multivitaminicos': { key: 'vitaminas_multivitaminicos', label: 'Multivitamínicos', cat: 'vitaminas' },
  'rendimiento-mental': { key: 'salud_rendimiento-mental', label: 'Rendimiento mental', cat: 'salud' },
  'articulaciones': { key: 'belleza_articulaciones', label: 'Articulaciones', cat: 'belleza' },
  'salud-sueno': { key: 'salud_salud-sueno', label: 'Salud de sueño', cat: 'salud' },
  'higado': { key: 'salud_higado', label: 'Hígado y Vesícula', cat: 'salud' },
  'diabetes': { key: 'salud_diabetes', label: 'Diabetes', cat: 'salud' },
  'prostata': { key: 'salud_prostata', label: 'Próstata', cat: 'salud' },
  'laxante': { key: 'salud_laxante', label: 'Laxante', cat: 'salud' },
  'energia': { key: 'suplementos_energia', label: 'Energía', cat: 'suplementos' },
  'Omega': { key: 'salud_omega', label: 'Omega', cat: 'salud' },
  'vitamina-b': { key: 'vitaminas_vitamina-b', label: 'Vitaminas B', cat: 'vitaminas' },
  'vitamina-d': { key: 'vitaminas_vitamina-d', label: 'Vitamina D', cat: 'vitaminas' },
  'vitamina-a': { key: 'vitaminas_vitamina-a', label: 'Vitamina A', cat: 'vitaminas' },
  'zinc': { key: 'vitaminas_zinc', label: 'Zinc', cat: 'vitaminas' },
  'biotina': { key: 'vitaminas_biotina', label: 'Biotina', cat: 'vitaminas' },
  'circulacion': { key: 'salud_circulacion', label: 'Circulación', cat: 'salud' },
  'sexualidad': { key: 'suplementos_sexualidad', label: 'Sexualidad', cat: 'suplementos' },
  'inflamacion': { key: 'salud_inflamacion', label: 'Inflamación', cat: 'salud' },
  'digestion': { key: 'salud_digestion', label: 'Digestión', cat: 'salud' }
};

// Marcas conocidas (para detectar en el nombre)
const MARCAS_CONOCIDAS = [
  'Natural Medix', 'Americano', 'Macel', 'Vitalim', 'Funat',
  'Prodenza', 'Venasfull', 'Nutripharma', 'GreenWorld',
  'Freshly', 'Naturally', 'Activ', 'Card', 'Peru',
  'Mountain Valley', 'Xtra Natura', 'Millenium Natural Systems',
  'Chocolate'
];

// Mapeo de palabras clave → subcategoría
const KEYWORD_MAP = [
  // Vitaminas y minerales
  { keywords: ['vitamina c', 'vit c', 'acerola'], sub: 'vitamina-c' },
  { keywords: ['vitamina e', 'vit e', '1000iu'], sub: 'vitamina-e' },
  { keywords: ['vitamina a', '600mg capsulas'], sub: 'vitamina-a' },
  { keywords: ['vitamina d3', 'calcio', 'calcium'], sub: 'calcio' },
  { keywords: ['magnesio', 'magnesium', 'magnesium glycinate', 'magnesium citrate', 'malate'], sub: 'magnesio' },
  { keywords: ['zinc', 'gluconate'], sub: 'zinc' },
  { keywords: ['biotina', 'biotin'], sub: 'biotina' },
  { keywords: ['complejo b', 'b-12', 'b12', 'methylcobalamin', 'niacinamide', 'vitamin b3'], sub: 'vitamina-b' },
  { keywords: ['multivitamin', 'multivit'], sub: 'multivitaminicos' },

  // Salud
  { keywords: ['omegas', 'omega 3', 'omega 6', 'omega 9', 'omega plus', 'co-enzyme', 'coenzima'], sub: 'Omega' },
  { keywords: ['melatonin', 'melatonina', 'sleep', 'dream maker'], sub: 'salud-sueno' },
  { keywords: ['ginkgo', 'biloba', 'rendimiento mental', 'neuro', 'stress', 'ashwagandha'], sub: 'rendimiento-mental' },
  { keywords: ['zarzaparrilla', 'diuretic', 'diuretico', 'ortiga'], sub: 'rinones' },
  { keywords: ['higado', 'vesicula', 'cardo mariano', 'milk thistle', 'hepat'], sub: 'higado' },
  { keywords: ['diabet', 'pasuchaca', 'diabcontrol', 'gluco'], sub: 'diabetes' },
  { keywords: ['prosta', 'prostan', 'prostasan'], sub: 'prostata' },
  { keywords: ['laxant', 'purgante', 'escobita', 'ciruelfort', 'digestar', 'fibaxil', 'jalea laxante', 'apetifort', 'chupa panza'], sub: 'laxante' },
  { keywords: ['resveratrol', 'nad'], sub: 'resveratrol' },
  { keywords: ['gastrit', 'acidez', 'gasgen'], sub: 'gastritis' },
  { keywords: ['circul', 'venasfull', 'cortilip', 'hemorroid', 'sinhemorrhoidas', 'lassacol'], sub: 'circulacion' },
  { keywords: ['desparasit', 'antax'], sub: 'desparasitacion' },
  { keywords: ['inflam', 'articula', 'glucosamina', 'xero fit'], sub: 'articulaciones' },
  { keywords: ['digest', 'oregano', 'garlic', 'ajo', 'curcuma', 'jengibre'], sub: 'digestion' },
  { keywords: ['shilajit', 'energia', 'forte', 'max forte', 'g4', 'ghr'], sub: 'energia' },
  { keywords: ['colageno', 'colage', 'peptido', 'collmax'], sub: 'colageno' },
  { keywords: ['chanc piedra', 'rinon', 'urovital', 'pipi loco'], sub: 'rinones' },

  // Potencia / Sexualidad
  { keywords: ['maca', 'potencia', 'masculin', 'mero macho', 'el matador', 'sex', 'love-gel', 'testo', 'megasex', 'king'], sub: 'potencia-masculina' },
  { keywords: ['ovarex', 'balance hormonal', 'ovar', 'famel', 'menst'], sub: 'balance-hormonal' },

  // Belleza
  { keywords: ['calendula', 'calen'], sub: 'calendula' },
  { keywords: ['colageno', 'peptido de colageno'], sub: 'colageno' },

  // Pérdida de peso
  { keywords: ['perdida', 'peso', 'diet', 'fatty', 'quemador', 'tira'], sub: 'perdida-de-peso' },

  // Antioxidantes
  { keywords: ['antioxidant', 'vit e', 'sulforaphane', 'proanthocyanidin'], sub: 'antioxidantes' },

  // Proteína / Creatina
  { keywords: ['proteina', 'whey', 'protein', 'colmax'], sub: 'proteina' },
  { keywords: ['creatina', 'creatin'], sub: 'creatina' },

  // Otros suplementos
  { keywords: ['propoleo', 'bee', 'miel', 'honey'], sub: 'sistema-inmunologico' },
  { keywords: ['leche de higueron', 'casiga'], sub: 'diabetes' },
  { keywords: ['propoleo kids'], sub: 'sistema-inmunologico' },
  { keywords: ['pip3r4sin'], sub: 'inflamacion' },
  { keywords: ['remartrin', 'r-qmaz', 'r-13'], sub: 'inflamacion' },
  { keywords: ['biocros'], sub: 'energia' },
  { keywords: ['b-chotta', 'bchotta'], sub: 'energia' },
  { keywords: ['jarabe totumo'], sub: 'inflamacion' },
  { keywords: ['vitafe', 'vitalfer', 'fer'], sub: 'salud-sanguinea' },
  { keywords: ['shilajit'], sub: 'energia' },
  { keywords: ['ulsn'], sub: 'gastritis' },
  { keywords: ['colage'], sub: 'colageno' },
  { keywords: ['neuro-stress'], sub: 'rendimiento-mental' },
  { keywords: ['freshlypausia'], sub: 'balance-hormonal' },
  { keywords: ['femax'], sub: 'balance-hormonal' },
  { keywords: ['megafort'], sub: 'energia' },
  { keywords: ['retardex'], sub: 'potencia-masculina' },
  { keywords: ['venasfull max'], sub: 'circulacion' },
  { keywords: ['vitamina a'], sub: 'vitamina-a' },
  { keywords: ['zinc gluconate'], sub: 'zinc' }
];

// ============ FUNCIONES ============

function limpiarNombreArchivo(filename) {
  // Quitar extensión y limpiar
  const ext = path.extname(filename);
  let nombre = path.basename(filename, ext);
  // Quitar espacios dobles raros de encoding
  nombre = nombre.replace(/\s+/g, ' ').trim();
  return nombre;
}

function extraerMarca(nombre) {
  // Buscar marca después de _ o al final
  const partes = nombre.split(/_/);
  if (partes.length > 1) {
    const posibleMarca = partes[partes.length - 1].trim();
    // Verificar si parece marca (empieza con mayúscula, no muy largo)
    if (posibleMarca.length < 30) {
      return { nombre: partes.slice(0, -1).join(' ').trim(), marca: posibleMarca };
    }
  }

  // Buscar entre paréntesis
  const parentMatch = nombre.match(/\(([^)]+)\)/);
  if (parentMatch) {
    return { nombre: nombre.replace(/\([^)]+\)/, '').trim(), marca: parentMatch[1].trim() };
  }

  // Buscar marca conocida en el nombre
  for (const marca of MARCAS_CONOCIDAS) {
    if (nombre.toLowerCase().includes(marca.toLowerCase())) {
      return { nombre: nombre, marca: marca };
    }
  }

  // Último word como posible marca
  const words = nombre.split(/\s+/);
  if (words.length > 2 && words[words.length - 1].length < 20) {
    return { nombre: words.slice(0, -1).join(' '), marca: words[words.length - 1] };
  }

  return { nombre: nombre, marca: '' };
}

function detectarSubcategoria(nombre) {
  const lower = nombre.toLowerCase();
  for (const mapping of KEYWORD_MAP) {
    for (const kw of mapping.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return mapping.sub;
      }
    }
  }
  return null;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generarCosto() {
  return randomInt(5000, 85000);
}

function generarPrecio(costo) {
  return Math.round(costo * (1.3 + Math.random() * 0.8));
}

// ============ CORRECCIONES MANUALES ============
const CORRECCIONES = {
  'p8':  { name: 'Apetifort 240g', brand: '' },
  'p9':  { name: 'Apetifort 300g', brand: '' },
  'p12': { name: 'Biotin 10000 mcg', brand: '' },
  'p14': { name: 'Chanca Piedra', brand: '' },
  'p16': { name: 'Ciruelfort Jalea Laxante', brand: '' },
  'p27': { name: 'Diente de León', brand: 'Natural Freshly' },
  'p28': { name: 'Digestar Jalea Laxante 190g', brand: '' },
  'p32': { name: 'Fenogreco Aleluya', brand: 'Natural Medix' },
  'p33': { name: 'Fibaxil Laxante de Fibra', brand: 'Americano' },
  'p37': { name: 'GHR-15 Plus', brand: 'Nutripharma' },
  'p40': { name: 'Echinacea 250mg', brand: 'Americano' },
  'p41': { name: 'Healthy Life Zarzaparrilla 500mg', brand: 'Americano' },
  'p47': { name: 'Leche de Higuerón con Casigua', brand: '' },
  'p50': { name: 'Magpro Magnesium Malate 500mg', brand: '' },
  'p52': { name: 'MegaSex 20 tabletas', brand: '' },
  'p54': { name: 'Mieltertos 4 Porciones', brand: '' },
  'p55': { name: 'Miletertos Max Forte', brand: '' },
  'p57': { name: 'Ashwagandha + Magnesium Glycinate', brand: 'Mountain Valley' },
  'p58': { name: 'Biotin 10000 mcg', brand: 'Mountain Valley' },
  'p59': { name: 'Magnesium Glycinate 550mg + D3', brand: 'Mountain Valley' },
  'p60': { name: 'Melatonin 10000 mcg', brand: 'Mountain Valley' },
  'p61': { name: 'Niacinamide Vitamin B3 500mg', brand: 'Mountain Valley' },
  'p62': { name: 'NEURO-STRESS HC', brand: '' },
  'p63': { name: 'B-12 Methylcobalamin 5000 mcg', brand: 'Americano' },
  'p64': { name: 'Co-enzyme Q-10 150mg', brand: 'Americano' },
  'p67': { name: 'Omega Plus 30 Softgels', brand: '' },
  'p71': { name: 'PIP3R4SIN Bebida Naranja 60mL', brand: '' },
  'p76': { name: 'Purgante La Escobita + Zarzaparrilla', brand: '' },
  'p77': { name: 'Péptidos de Colágeno Hidrolizado', brand: '' },
  'p81': { name: 'Resveratrol 3000 + NAD Ultra', brand: '' },
  'p84': { name: 'Shilajit 10000mg', brand: 'GreenWorld' },
  'p98': { name: 'Vitamina A 600mg', brand: '' },
  'p99': { name: 'Vitamina D3 + Calcio 600mg', brand: '' },
  'p100': { name: 'Vitamina E 1000IU', brand: '' },
  'p102': { name: 'Ginkgo Biloba 60mg', brand: 'Xtra Natura' },
  'p103': { name: 'Omega 3 1000mg', brand: 'Xtra Natura' }
};

// ============ MAIN ============

const archivos = fs.readdirSync(CARPETA_IMAGENES)
  .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
  .sort();

console.log(`📁 Encontradas ${archivos.length} imágenes\n`);

// Crear carpeta destino
if (!fs.existsSync(CARPETA_DESTINO)) {
  fs.mkdirSync(CARPETA_DESTINO, { recursive: true });
}

const productos = [];
let id = 1;

for (const archivo of archivos) {
  const nombreLimpio = limpiarNombreArchivo(archivo);
  const { nombre: nombreProducto, marca } = extraerMarca(nombreLimpio);
  const subKey = detectarSubcategoria(nombreLimpio);
  const sub = subKey ? SUBS[subKey] : null;
  const categoria = sub ? sub.cat : 'suplementos';
  const subcategoria = sub ? sub.key : '';
  const subLabel = sub ? sub.label : 'Sin categoría';

  // Copiar imagen
  const destino = path.join(CARPETA_DESTINO, archivo);
  if (!fs.existsSync(destino)) {
    fs.copyFileSync(path.join(CARPETA_IMAGENES, archivo), destino);
  }

  const producto = {
    id: 'p' + id,
    name: nombreProducto,
    barcode: '',
    brand: marca,
    category: categoria,
    subcategory: subcategoria,
    price: generarPrecio(generarCosto()),
    cost: generarCosto(),
    stock: randomInt(1, 20),
    img: 'img/productos/' + archivo,
    images: [],
    desc: '',
    supplier: '',
    featured: false,
    _synced: false
  };

  // Aplicar correcciones manuales
  const fix = CORRECCIONES['p' + id];
  if (fix) {
    if (fix.name) producto.name = fix.name;
    if (fix.brand !== undefined) producto.brand = fix.brand;
  }

  productos.push(producto);
  id++;

  console.log(`${producto.id}: ${producto.name} | Marca: ${producto.brand || '?'} | Cat: ${categoria} | Sub: ${subLabel}`);
}

// Guardar JSON
const output = path.join(__dirname, 'productos_importados.json');
fs.writeFileSync(output, JSON.stringify(productos, null, 2));
console.log(`\n✅ ${productos.length} productos guardados en ${output}`);
console.log(`📂 Imágenes copiadas a ${CARPETA_DESTINO}`);

// Generar script para consola del navegador
let consoleScript = `// ============ IMPORTAR PRODUCTOS ============
// Copia y pega esto en la consola del navegador (F12 → Console)
(function() {
  const productos = ${JSON.stringify(productos, null, 2)};

  // Cargar productos existentes
  let posProducts = JSON.parse(localStorage.getItem('posProducts')) || [];
  let nextId = posProducts.reduce((m, p) => Math.max(m, parseInt(p.id.replace('p',''))), 0) + 1;

  // Agregar productos nuevos
  for (const p of productos) {
    p.id = 'p' + (nextId++);
    posProducts.push(p);
  }

  localStorage.setItem('posProducts', JSON.stringify(posProducts));
  console.log('✅ ' + productos.length + ' productos importados. Total: ' + posProducts.length);
  alert(productos.length + ' productos importados correctamente!');
})();

// ============ IMPORTAR CATEGORÍAS ============
(function() {
  let cats = JSON.parse(localStorage.getItem('posCategories')) || [];
  const newCats = [
    { key: 'suplementos', label: 'Suplementos', _synced: false },
    { key: 'belleza-y-bienestar', label: 'Belleza y bienestar', _synced: false },
    { key: 'salud-y-bienestar', label: 'Salud y bienestar', _synced: false },
    { key: 'vitaminas-y-minerales', label: 'Vitaminas y minerales', _synced: false },
    { key: 'suplementos_complejo-b', label: 'Complejo B', parent_key: 'suplementos', _synced: false },
    { key: 'suplementos_salud-sanguinea', label: 'Salud sanguínea', parent_key: 'suplementos', _synced: false },
    { key: 'vitaminas_antioxidantes', label: 'Antioxidantes', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'salud_limpieza-intestinal', label: 'Limpieza intestinal', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'suplementos_sistema-inmunologico', label: 'Sistema inmunológico', parent_key: 'suplementos', _synced: false },
    { key: 'belleza_calendula', label: 'Calendula', parent_key: 'belleza-y-bienestar', _synced: false },
    { key: 'belleza_colageno', label: 'Colageno', parent_key: 'belleza-y-bienestar', _synced: false },
    { key: 'suplementos_potencia-masculina', label: 'Potencia Masculina', parent_key: 'suplementos', _synced: false },
    { key: 'salud_rinones', label: 'Riñones y vías urinarias', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_gastritis', label: 'Gastritis y acidez', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'belleza_glucosamina', label: 'Glucosamina', parent_key: 'belleza-y-bienestar', _synced: false },
    { key: 'suplementos_balance-hormonal', label: 'Balance hormonal', parent_key: 'suplementos', _synced: false },
    { key: 'suplementos_perdida-de-peso', label: 'Pérdida de peso', parent_key: 'suplementos', _synced: false },
    { key: 'vitaminas_magnesio', label: 'Magnecio', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_vitamina-e', label: 'Vitamina E', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_calcio', label: 'Calcio', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'suplementos_creatina', label: 'Creatina', parent_key: 'suplementos', _synced: false },
    { key: 'suplementos_proteina', label: 'Proteina', parent_key: 'suplementos', _synced: false },
    { key: 'vitaminas_vitamina-c', label: 'Vitamina C', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'salud_desparasitacion', label: 'Desparasitación', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'suplementos_resveratrol', label: 'Resveratrol', parent_key: 'suplementos', _synced: false },
    { key: 'vitaminas_multivitaminicos', label: 'Multivitamínicos', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'salud_rendimiento-mental', label: 'Rendimiento mental', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'belleza_articulaciones', label: 'Articulaciones', parent_key: 'belleza-y-bienestar', _synced: false },
    { key: 'salud_salud-sueno', label: 'Salud de sueño', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_higado', label: 'Hígado y Vesícula', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_diabetes', label: 'Diabetes', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_prostata', label: 'Próstata', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_laxante', label: 'Laxante', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'suplementos_energia', label: 'Energía', parent_key: 'suplementos', _synced: false },
    { key: 'salud_omega', label: 'Omega', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'vitaminas_vitamina-b', label: 'Vitaminas B', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_vitamina-d', label: 'Vitamina D', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_vitamina-a', label: 'Vitamina A', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_zinc', label: 'Zinc', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'vitaminas_biotina', label: 'Biotina', parent_key: 'vitaminas-y-minerales', _synced: false },
    { key: 'salud_circulacion', label: 'Circulación', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'suplementos_sexualidad', label: 'Sexualidad', parent_key: 'suplementos', _synced: false },
    { key: 'salud_inflamacion', label: 'Inflamación', parent_key: 'salud-y-bienestar', _synced: false },
    { key: 'salud_digestion', label: 'Digestión', parent_key: 'salud-y-bienestar', _synced: false }
  ];

  for (const c of newCats) {
    if (!cats.find(x => x.key === c.key)) {
      cats.push(c);
    }
  }

  localStorage.setItem('posCategories', JSON.stringify(cats));
  console.log('✅ ' + cats.length + ' categorías configuradas.');
})();
`;

const consolePath = path.join(__dirname, 'importar_consola.js');
fs.writeFileSync(consolePath, consoleScript);
console.log(`🖥️  Script para consola: ${consolePath}`);

console.log('\n📋 INSTRUCCIONES:');
console.log('1. Abre tu POS en el navegador');
console.log('2. Abre la consola (F12 → Console)');
console.log('3. Copia y pega el contenido de "importar_consola.js"');
console.log('4. Presiona Enter');
console.log('5. ¡Listo! Los productos y categorías aparecerán en el POS');
