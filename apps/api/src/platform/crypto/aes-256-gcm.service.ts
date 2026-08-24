import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const INITIALIZATION_VECTOR_LENGTH = 12;
const PAYLOAD_VERSION = 'v1';
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class InvalidEncryptionKeyError extends Error {
  constructor() {
    super(
      'The encryption key must be a canonical base64-encoded 32-byte value.',
    );
    this.name = 'InvalidEncryptionKeyError';
  }
}

export class DecryptionFailedError extends Error {
  constructor() {
    super('Unable to decrypt the ciphertext.');
    this.name = 'DecryptionFailedError';
  }
}

export class Aes256GcmService {
  private readonly key: Buffer;
  readonly keyVersion = PAYLOAD_VERSION;

  constructor(keyBase64: string) {
    this.key = decodeKey(keyBase64);
  }

  encrypt(plaintext: string, authenticatedContext?: string): string {
    const initializationVector = randomBytes(INITIALIZATION_VECTOR_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, initializationVector, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    if (authenticatedContext !== undefined) {
      cipher.setAAD(Buffer.from(authenticatedContext, 'utf8'));
    }

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      PAYLOAD_VERSION,
      initializationVector.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string, authenticatedContext?: string): string {
    const [
      version,
      initializationVectorBase64,
      authTagBase64,
      ciphertextBase64,
      ...remainder
    ] = payload.split('.');

    if (
      version !== PAYLOAD_VERSION ||
      remainder.length > 0 ||
      !initializationVectorBase64 ||
      !authTagBase64 ||
      ciphertextBase64 === undefined
    ) {
      throw new DecryptionFailedError();
    }

    try {
      const initializationVector = decodeBase64(initializationVectorBase64);
      const authTag = decodeBase64(authTagBase64);
      const ciphertext = decodeBase64(ciphertextBase64);

      if (
        initializationVector.length !== INITIALIZATION_VECTOR_LENGTH ||
        authTag.length !== AUTH_TAG_LENGTH
      ) {
        throw new Error('Invalid AES-GCM payload dimensions.');
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        initializationVector,
        {
          authTagLength: AUTH_TAG_LENGTH,
        },
      );
      decipher.setAuthTag(authTag);

      if (authenticatedContext !== undefined) {
        decipher.setAAD(Buffer.from(authenticatedContext, 'utf8'));
      }

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new DecryptionFailedError();
    }
  }
}

function decodeKey(keyBase64: string): Buffer {
  if (!isCanonicalBase64(keyBase64)) {
    throw new InvalidEncryptionKeyError();
  }

  const key = Buffer.from(keyBase64, 'base64');

  if (key.length !== 32) {
    throw new InvalidEncryptionKeyError();
  }

  return key;
}

function decodeBase64(value: string): Buffer {
  if (!isCanonicalBase64(value)) {
    throw new Error('Invalid base64.');
  }

  return Buffer.from(value, 'base64');
}

function isCanonicalBase64(value: string): boolean {
  return (
    BASE64_PATTERN.test(value) &&
    Buffer.from(value, 'base64').toString('base64') === value
  );
}
