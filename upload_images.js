const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://jcksqhqopqhswwxskhls.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impja3NxaHFvcHFoc3d3eHNraGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTIzNjksImV4cCI6MjA5NjQ4ODM2OX0.1hnEgbk9--eedO1Tw9L0p6NKtHkz9h9NENEFiFJjbj0';
const BUCKET = 'product-images';

const IMG_DIR = path.join(__dirname, 'img', 'productos');
const PRODUCTS_FILE = path.join(__dirname, 'productos_importados.json');

function supabaseUpload(filename, fileBuffer) {
  return new Promise((resolve, reject) => {
    const storagePath = 'products/' + filename;
    const url = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
          resolve(publicUrl);
        } else {
          reject(new Error(`Upload failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  const images = fs.readdirSync(IMG_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  
  console.log(`📁 ${images.length} imágenes para subir\n`);

  let uploaded = 0, failed = 0, skipped = 0;

  for (const imgFile of images) {
    const imgPath = path.join(IMG_DIR, imgFile);
    const fileBuffer = fs.readFileSync(imgPath);
    
    // Find product with this image
    const localRef = 'img/productos/' + imgFile;
    const product = products.find(p => p.img === localRef);
    
    // Generate Supabase filename
    const ext = path.extname(imgFile).slice(1);
    const supaName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    
    try {
      const publicUrl = await supabaseUpload(supaName, fileBuffer);
      
      if (product) {
        product.img = publicUrl;
      }
      
      uploaded++;
      process.stdout.write(`\r${uploaded}/${images.length} subidas...`);
    } catch (err) {
      console.error(`\n❌ ${imgFile}: ${err.message}`);
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await sleep(100);
  }

  // Save updated products
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  
  console.log(`\n\n✅ Subidas: ${uploaded}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📁 Archivo actualizado: ${PRODUCTS_FILE}`);
  console.log('\nAhora importa de nuevo desde el POS (botón púrpura Importar).');
}

main().catch(console.error);
