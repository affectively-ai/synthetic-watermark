/**
 * Audio Watermarking Service
 *
 * Embeds invisible/inaudible metadata into synthesized audio to indicate
 * "Synthetic Origin" - marking AI-generated audio for safety and authenticity.
 *
 * Approach: Adds a metadata comment to the MP3 ID3 tag or embeds a
 * high-frequency inaudible tone pattern (above 18kHz) that serves as
 * a digital fingerprint.
 *
 * For MP3 format: Uses ID3 tag metadata injection
 * For raw formats: Could use frequency-domain watermarking (future)
 */

import { Buffer } from 'buffer';

/**
 * Watermark configuration
 */
export interface WatermarkConfig {
  /** Platform identifier */
  platform: string;
  /** Timestamp of generation */
  timestamp: number;
  /** Source system (e.g., 'cyrano', 'hologram', 'twin') */
  source: string;
  /** Optional user ID (hashed) for audit trail */
  userIdHash?: string;
}

/**
 * Default watermark configuration
 */
const DEFAULT_WATERMARK: Omit<WatermarkConfig, 'timestamp'> = {
  platform: 'SYNTHETIC',
  source: 'tts',
};

/**
 * ID3v2 frame for adding comment with synthetic origin marker
 * This creates a minimal ID3v2.3 header with a COMM (comment) frame
 */
function createID3WatermarkTag(config: WatermarkConfig) {
  const comment = `SYNTHETIC_AUDIO|${config.platform}|${config.source}|${
    config.timestamp
  }${config.userIdHash ? `|${config.userIdHash}` : ''}`;

  // COMM frame structure:
  // - Frame ID: "COMM" (4 bytes)
  // - Size: (4 bytes, big-endian)
  // - Flags: 0x0000 (2 bytes)
  // - Encoding: 0x00 (ISO-8859-1)
  // - Language: "eng" (3 bytes)
  // - Short content desc: terminated with 0x00
  // - Actual text: terminated with 0x00

  const encoding = Buffer.from([0x00]); // ISO-8859-1
  const language = Buffer.from('eng');
  const shortDesc = Buffer.from('SYNTHETIC_ORIGIN\x00', 'binary');
  const text = Buffer.concat([
    Buffer.from(comment, 'utf-8'),
    Buffer.from([0x00]),
  ] as unknown as Uint8Array[]);

  const frameContent = Buffer.concat([
    encoding,
    language,
    shortDesc,
    text,
  ] as unknown as Uint8Array[]);

  // Frame header
  const frameId = Buffer.from('COMM');
  const frameSize = Buffer.alloc(4);
  frameSize.writeUInt32BE(frameContent.length, 0);
  const frameFlags = Buffer.from([0x00, 0x00]);

  const frame = Buffer.concat([
    frameId,
    frameSize,
    frameFlags,
    frameContent,
  ] as unknown as Uint8Array[]);

  // ID3v2 header
  const id3Header = Buffer.from([
    0x49,
    0x44,
    0x33, // "ID3"
    0x03,
    0x00, // Version 2.3
    0x00, // Flags
  ]);

  // Size is syncsafe (7 bits per byte)
  // Size here is the total size of everything AFTER the 10-byte header
  const size = frame.length;
  const syncsafeSize = Buffer.alloc(4);
  syncsafeSize[0] = (size >> 21) & 0x7f;
  syncsafeSize[1] = (size >> 14) & 0x7f;
  syncsafeSize[2] = (size >> 7) & 0x7f;
  syncsafeSize[3] = size & 0x7f;

  return Buffer.concat([
    id3Header,
    syncsafeSize,
    frame,
  ] as unknown as Uint8Array[]);
}

/**
 * Check if audio buffer already has an ID3 tag
 */
function hasID3Tag(audioBuffer: Uint8Array): boolean {
  if (audioBuffer.length < 10) return false;
  return (
    audioBuffer[0] === 0x49 && // 'I'
    audioBuffer[1] === 0x44 && // 'D'
    audioBuffer[2] === 0x33 // '3'
  );
}

/**
 * Get size of existing ID3 tag (if present)
 */
function getID3TagSize(audioBuffer: Uint8Array): number {
  if (!hasID3Tag(audioBuffer)) return 0;

  // Size is in bytes 6-9 as syncsafe integer
  const size =
    ((audioBuffer[6] & 0x7f) << 21) |
    ((audioBuffer[7] & 0x7f) << 14) |
    ((audioBuffer[8] & 0x7f) << 7) |
    (audioBuffer[9] & 0x7f);

  return size + 10; // Add header size
}

/**
 * Embed watermark into audio buffer
 *
 * For MP3: Prepends ID3v2 tag with synthetic origin metadata
 * For other formats: Passes through unchanged (future: frequency watermarking)
 *
 * @param audioBuffer - Raw audio data
 * @param format - Audio format (mp3, wav, etc.)
 * @param config - Watermark configuration
 * @returns Watermarked audio buffer
 */
export function embedAudioWatermark(
  audioBuffer: Buffer,
  format: string = 'mp3',
  config: Partial<WatermarkConfig> = {},
): Buffer {
  const fullConfig: WatermarkConfig = {
    ...DEFAULT_WATERMARK,
    timestamp: Date.now(),
    ...config,
  };

  // Only watermark MP3 for now (most common TTS output)
  const normalizedFormat = format.toLowerCase();
  if (normalizedFormat !== 'mp3') {
    return audioBuffer;
  }

  try {
    let audioData = audioBuffer;

    // Check if already has ID3 tag
    const bufferArray = new Uint8Array(audioBuffer);
    if (hasID3Tag(bufferArray)) {
      const existingTagSize = getID3TagSize(bufferArray);
      if (existingTagSize <= audioBuffer.length) {
        audioData = audioBuffer.subarray(existingTagSize);
      }
    }

    // Prepend watermark
    const watermarkTag = createID3WatermarkTag(fullConfig);

    return Buffer.concat([watermarkTag, audioData] as unknown as Uint8Array[]);
  } catch {
    // On any error, return original audio (safety first)
    return audioBuffer;
  }
}

/**
 * Check if audio has synthetic origin watermark
 *
 * @param audioBuffer - Audio data to check
 * @returns Watermark info if found, null otherwise
 */
export function detectSyntheticWatermark(
  audioBuffer: Buffer,
): WatermarkConfig | null {
  const bufferArray = new Uint8Array(audioBuffer);
  if (!hasID3Tag(bufferArray)) {
    return null;
  }

  try {
    // Search for COMM frame with SYNTHETIC_ORIGIN
    const searchStr = 'SYNTHETIC_ORIGIN';

    const idx = audioBuffer.indexOf(searchStr);
    if (idx === -1) return null;

    // The text follows the SYNTHETIC_ORIGIN\0 marker
    const markerEnd = idx + searchStr.length + 1;
    if (markerEnd >= audioBuffer.length) return null;

    // Find the SYNTHETIC_AUDIO marker after it
    const markerStart = audioBuffer.indexOf('SYNTHETIC_AUDIO|', markerEnd);
    if (markerStart === -1) return null;

    // Extract the comment text, stopping at null terminator
    let end = markerStart;
    while (end < audioBuffer.length && audioBuffer[end] !== 0x00) {
      end++;
    }

    const comment = audioBuffer.subarray(markerStart, end).toString('utf-8');
    const parts = comment.split('|');

    if (parts.length >= 4) {
      return {
        platform: parts[1] || '',
        source: parts[2] || '',
        timestamp: parseInt(parts[3] || '0', 10),
        userIdHash: parts[4],
      };
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Convenience function for Digital Twin audio
 */
export function watermarkDigitalTwinAudio(
  audioBuffer: Buffer,
  format = 'mp3',
  userIdHash?: string,
): Buffer {
  return embedAudioWatermark(audioBuffer, format, {
    source: 'digital_twin',
    userIdHash,
  });
}

/**
 * Convenience function for Hologram audio
 */
export function watermarkHologramAudio(
  audioBuffer: Buffer,
  format = 'mp3',
): Buffer {
  return embedAudioWatermark(audioBuffer, format, {
    source: 'hologram',
  });
}

/**
 * Convenience function for Cyrano TTS audio
 */
export function watermarkCyranoAudio(
  audioBuffer: Buffer,
  format = 'mp3',
): Buffer {
  return embedAudioWatermark(audioBuffer, format, {
    source: 'cyrano',
  });
}
