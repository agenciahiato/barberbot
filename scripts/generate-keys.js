'use strict';

/**
 * Genera el par RSA 2048 que pide WhatsApp Flows.
 * Uso: node scripts/generate-keys.js
 *
 * Después:
 *   1. Copia FLOW_PRIVATE_KEY y FLOW_PUBLIC_KEY al .env (escapando saltos con \n).
 *   2. Sube la pública con la API de WhatsApp:
 *        POST /{phone_number_id}/whatsapp_business_encryption
 *        Header: Authorization: Bearer <WHATSAPP_TOKEN>
 *        Body:  business_public_key=<contenido público en formato PEM>
 */

const crypto = require('crypto');

const passphrase = process.argv[2] || 'cambia_esta_passphrase';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase,
  },
});

console.log('FLOW_PASSPHRASE=' + passphrase + '\n');
console.log('FLOW_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"\n');
console.log('FLOW_PUBLIC_KEY="' + publicKey.replace(/\n/g, '\\n') + '"\n');
console.log('# Guarda también el archivo público para subirlo a Meta:');
console.log(publicKey);
