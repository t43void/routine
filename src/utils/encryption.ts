/**
 * End-to-End Encryption Utilities
 * Similar to Telegram's encryption approach
 */

// Generate a key pair for E2EE
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Export public key to store in database
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

// Import public key from database
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(publicKeyBase64);
  return await window.crypto.subtle.importKey(
    "spki",
    keyData,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

// Derive shared secret from key pairs
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt message using AES-GCM
export async function encryptMessage(
  message: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

// Decrypt message using AES-GCM
export async function decryptMessage(
  encryptedData: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  try {
    const encrypted = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Failed to decrypt message");
  }
}

// Generate encryption key from user session (simpler approach)
export async function generateSessionKey(userId: string, friendId: string): Promise<CryptoKey> {
  // Create a deterministic key from user IDs - sort IDs to ensure consistency
  // This ensures the same key is generated regardless of who sends/receives
  const sortedIds = [userId, friendId].sort();
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(`${sortedIds[0]}:${sortedIds[1]}:chat-secret`);
  
  // Use PBKDF2 to derive a key
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("neon-ledger-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Generate group encryption key
// IMPORTANT: Only uses groupId, not userId, so all group members use the same key
export async function generateGroupKey(groupId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(`${groupId}:group-secret`);
  
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("neon-ledger-group-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Generate old group encryption key (for backward compatibility with old messages)
// This was the old method that included userId - kept for decrypting old messages
export async function generateGroupKeyOld(groupId: string, userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(`${groupId}:${userId}:group-secret`);
  
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("neon-ledger-group-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Check if message is encrypted (has encryption metadata)
export function isEncrypted(message: string): boolean {
  try {
    const parsed = JSON.parse(message);
    return parsed.encrypted === true && parsed.data && parsed.iv;
  } catch {
    return false;
  }
}

// Format encrypted message for storage
export function formatEncryptedMessage(encrypted: string, iv: string): string {
  return JSON.stringify({
    encrypted: true,
    data: encrypted,
    iv: iv,
  });
}

// Parse encrypted message from storage
export function parseEncryptedMessage(message: string): { encrypted: string; iv: string } | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed.encrypted && parsed.data && parsed.iv) {
      return {
        encrypted: parsed.data,
        iv: parsed.iv,
      };
    }
  } catch {
    // Not encrypted, return null
  }
  return null;
}

