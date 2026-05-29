'use strict';

/**
 * Cifrado de WhatsApp Flows (Meta).
 *
 *   1. Meta envía:   { encrypted_flow_data, encrypted_aes_key, initial_vector }
 *   2. Descifras la AES key con tu RSA private key (OAEP-SHA256).
 *   3. Descifras flow_data con AES-128-GCM usando esa key y el IV.
 *   4. Procesas, devuelves la respuesta cifrada con la MISMA AES key
 *      pero con el IV con todos sus bytes invertidos (~ bitwise NOT).
 *
 * Documentación: developers.facebook.com/docs/whatsapp/flows/reference/implementingyourflowendpoint
 */

const crypto = require('crypto');

function getPrivateKey() {
  const pem = (process.env.FLOW_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return crypto.createPrivateKey({
    key: pem,
    passphrase: process.env.FLOW_PASSPHRASE,
  });
}

function decryptRequest({ encrypted_flow_data, encrypted_aes_key, initial_vector }) {
  const privateKey = getPrivateKey();

  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encrypted_aes_key, 'base64')
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const ivBuffer = Buffer.from(initial_vector, 'base64');

  // los últimos 16 bytes son el authTag de GCM
  const TAG_LENGTH = 16;
  const encrypted = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, ivBuffer);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return { decryptedBody: JSON.parse(decrypted.toString('utf-8')), aesKey, ivBuffer };
}

function encryptResponse(responseObj, aesKey, ivBuffer) {
  // IV invertido bit a bit
  const flippedIv = Buffer.from(ivBuffer.map((b) => ~b & 0xff));
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseObj), 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString('base64');
}

module.exports = { decryptRequest, encryptResponse };
