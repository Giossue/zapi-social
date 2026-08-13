import { MAX_FILE_BYTES } from '@workspace/file-ingestion';
import {
  googleDriveFailureForStatus,
  nextDriveByteCount,
} from './google-drive-import.processor';

describe('Google Drive import hardening', () => {
  it('retries only rate limits and provider/server failures', () => {
    expect(googleDriveFailureForStatus(429)).toMatchObject({ retryable: true });
    expect(googleDriveFailureForStatus(503)).toMatchObject({ retryable: true });
    expect(googleDriveFailureForStatus(401)).toMatchObject({
      code: 'GOOGLE_DRIVE_IMPORT_EXPIRED',
      retryable: false,
    });
    expect(googleDriveFailureForStatus(403)).toMatchObject({
      code: 'GOOGLE_DRIVE_PERMISSION_DENIED',
      retryable: false,
    });
    expect(googleDriveFailureForStatus(404)).toMatchObject({
      code: 'GOOGLE_DRIVE_FILE_NOT_FOUND',
      retryable: false,
    });
  });

  it('bounds the stream by declared and absolute size without buffering it', () => {
    expect(nextDriveByteCount(0, 1024, 2048)).toBe(1024);
    expect(() => nextDriveByteCount(1024, 1025, 2048)).toThrow(
      'GOOGLE_DRIVE_FILE_TOO_LARGE',
    );
    expect(() =>
      nextDriveByteCount(MAX_FILE_BYTES, 1, MAX_FILE_BYTES + 1),
    ).toThrow('GOOGLE_DRIVE_FILE_TOO_LARGE');
  });
});
