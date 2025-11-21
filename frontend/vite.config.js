import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if SSL certificates exist
const keyPath = path.resolve(__dirname, 'cert/key.pem');
const certPath = path.resolve(__dirname, 'cert/cert.pem');

let httpsConfig = undefined;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  httpsConfig = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  console.log('✓ Using HTTPS with SSL certificates');
} else {
  console.warn('\n⚠️  SSL certificates not found!');
  console.warn('Tableau Extensions require HTTPS. Please generate certificates:\n');
  console.warn('  cd frontend');
  console.warn('  mkdir cert');
  console.warn('  openssl genrsa -out cert/key.pem 2048');
  console.warn('  openssl req -new -x509 -key cert/key.pem -out cert/cert.pem -days 365\n');
  console.warn('Running without HTTPS for now...\n');
}

export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsConfig,
    port: httpsConfig ? 8443 : 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    'process.env': {}
  }
});
