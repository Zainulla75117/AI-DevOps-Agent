/**
 * Encryption Service using the native Web Crypto API.
 * No external dependencies (crypto-js, node-forge) required.
 * 
 * Uses Hybrid Encryption:
 *   - RSA-OAEP (SHA-256) to encrypt a one-time AES key
 *   - AES-256-CBC to encrypt the actual JSON payload
 */
class EncryptionService {

  /**
   * Fetch the RSA public key from the backend.
   * We fetch it fresh every time to avoid stale-key issues
   * caused by backend hot-reloads regenerating the keypair.
   */
  async getPublicKey(baseUrl, path) {
    try {
      const endpoint = path || '/api/crypto/public-key';
      const response = await fetch(`${baseUrl}${endpoint}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data?.public_key || null;
    } catch (error) {
      console.error('Failed to fetch public key:', error);
      return null;
    }
  }

  /**
   * Convert a PEM-encoded public key string to an ArrayBuffer
   * that the Web Crypto API can import.
   */
  pemToArrayBuffer(pem) {
    const b64 = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/[\r\n\s]/g, '');
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert an ArrayBuffer to a Base64 string.
   * Uses a loop instead of spread operator to avoid call-stack limits on large payloads.
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Encrypt a JSON-serializable payload using Hybrid RSA+AES.
   * @param {Object} data - The plain object to encrypt
   * @param {string} baseUrl - Backend base URL
   * @param {string} publicKeyPath - Path to the public key endpoint
   * @returns {Object} Encrypted envelope { encrypted_data, encrypted_key, iv }
   */
  async encryptPayload(data, baseUrl, publicKeyPath) {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const pemKey = await this.getPublicKey(normalizedBaseUrl, publicKeyPath);

    if (!pemKey) {
      console.warn('⚠️ No public key available — sending payload unencrypted.');
      return data;
    }

    try {
      // Serialize the payload to UTF-8 bytes
      const jsonStr = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(jsonStr);

      // 1. Import the RSA public key (SPKI format, RSA-OAEP with SHA-256)
      const keyBuffer = this.pemToArrayBuffer(pemKey);
      const rsaKey = await crypto.subtle.importKey(
        'spki',
        keyBuffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      );

      // 2. Generate a random AES-256 key (32 bytes) and IV (16 bytes)
      const aesKeyRaw = crypto.getRandomValues(new Uint8Array(32));
      const ivBytes = crypto.getRandomValues(new Uint8Array(16));

      // 3. Import AES key for Web Crypto
      const aesKey = await crypto.subtle.importKey(
        'raw',
        aesKeyRaw,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      // 4. Encrypt data with AES-256-CBC (PKCS7 padding is automatic)
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: ivBytes },
        aesKey,
        dataBytes
      );

      // 5. Encrypt the raw AES key bytes with RSA-OAEP
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        rsaKey,
        aesKeyRaw
      );

      // 6. Base64-encode for JSON transport
      return {
        encrypted_data: this.arrayBufferToBase64(encryptedData),
        encrypted_key: this.arrayBufferToBase64(encryptedKey),
        iv: this.arrayBufferToBase64(ivBytes)
      };
    } catch (err) {
      console.error('Encryption failed:', err);
      return data; // fallback: send unencrypted
    }
  }
}

export const encryptionService = new EncryptionService();
