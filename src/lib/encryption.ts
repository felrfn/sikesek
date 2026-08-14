import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.TICKET_ENCRYPTION_KEY || 'default_secret_key_needs_32_bytes';
const IV_LENGTH = 16;

export function encryptTicketPayload(payload: object): string {
  try {
    const text = JSON.stringify(payload);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    
    // Ensure key is 32 bytes
    if (key.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
    }

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return iv and encrypted data joined by a colon
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
}

export function decryptTicketPayload(encryptedText: string): any {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = textParts[1];
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');

    if (key.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}
