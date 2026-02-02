/**
 * Image Watermarking Service
 *
 * Embeds INVISIBLE metadata into generated images to indicate
 * "Synthetic Origin" - marking AI-generated images for safety/authenticity.
 *
 * These watermarks are completely invisible to users.
 * They are stored in the PNG file's metadata chunks (iTXt/tEXt),
 * not rendered on the image itself. Similar to EXIF data in photos.
 *
 * For PNG format: Uses ancillary iTXt chunk (international text)
 * For JPEG format: Could use EXIF/XMP metadata (future)
 * For WebP format: Could use XMP metadata (future)
 */

import { Buffer } from 'buffer';

/**
 * Watermark configuration
 */
export interface ImageWatermarkConfig {
  /** Platform identifier */
  platform: string;
  /** Timestamp of generation */
  timestamp: number;
  /** Source system (e.g., 'dalle', 'imagen', 'gemini', 'digital_twin') */
  source: string;
  /** Optional user ID (hashed) for audit trail */
  userIdHash?: string;
  /** Optional model name */
  model?: string;
}

/**
 * Default watermark configuration
 */
const DEFAULT_WATERMARK: Omit<ImageWatermarkConfig, 'timestamp'> = {
  platform: 'SYNTHETIC',
  source: 'ai_generated',
};

/**
 * PNG signature bytes
 */
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Check if buffer is a PNG image
 */
function isPNG(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  // Compare first 8 bytes with PNG signature
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Calculate CRC32 for PNG chunk
 */
function crc32(data: Uint8Array): number {
  // CRC32 lookup table
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Create a PNG iTXt chunk with synthetic origin marker
 *
 * iTXt chunk structure:
 * - Keyword: null-terminated (e.g., "SyntheticOrigin")
 * - Compression flag: 0 (uncompressed)
 * - Compression method: 0
 * - Language tag: null-terminated (e.g., "en")
 * - Translated keyword: null-terminated (empty)
 * - Text: UTF-8 encoded
 */
function createiTXtChunk(config: ImageWatermarkConfig) {
  const keyword = 'SyntheticOrigin';
  // Format: SYNTHETIC_IMAGE|platform|source|timestamp|userIdHash|model
  // Always include all fields to maintain consistent positions
  const text = `SYNTHETIC_IMAGE|${config.platform}|${config.source}|${
    config.timestamp
  }|${config.userIdHash || ''}|${config.model || ''}`;

  // Build chunk data
  const keywordBuf = Buffer.from(keyword + '\x00');
  const compressionFlag = Buffer.from([0x00]); // No compression
  const compressionMethod = Buffer.from([0x00]);
  const languageTag = Buffer.from('en\x00');
  const translatedKeyword = Buffer.from('\x00'); // Empty
  const textBuf = Buffer.from(text);

  const chunkData = Buffer.concat([
    keywordBuf,
    compressionFlag,
    compressionMethod,
    languageTag,
    translatedKeyword,
    textBuf,
  ] as unknown as Uint8Array[]);

  // Build chunk: type + data
  const chunkType = Buffer.from('iTXt');
  const typeAndData = Buffer.concat([
    chunkType,
    chunkData,
  ] as unknown as Uint8Array[]);

  // Calculate CRC
  const crcValue = crc32(new Uint8Array(typeAndData));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcValue, 0);

  // Build full chunk: length + type + data + CRC
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(chunkData.length, 0);

  const parts = [
    lengthBuf,
    chunkType,
    chunkData,
    crcBuf,
  ] as unknown as Uint8Array[];
  return Buffer.concat(parts);
}

/**
 * Find the position of IEND chunk in PNG
 */
function findIENDPosition(buffer: Uint8Array): number {
  const iendMarker = Buffer.from('IEND');
  // Search for IEND chunk type (0x49, 0x45, 0x4e, 0x44)
  // Start after signature (8 bytes) and IHDR chunk (minimum)
  for (let i = 8; i < buffer.length - 8; i++) {
    const slice = buffer.subarray(i + 4, i + 8);
    if (Buffer.from(slice).equals(iendMarker)) {
      return i; // Return position of length field
    }
  }

  return -1;
}

/**
 * Embed INVISIBLE watermark into image buffer
 *
 * For PNG: Inserts iTXt chunk before IEND
 * For other formats: Passes through unchanged (future: EXIF/XMP)
 *
 * The watermark is stored in metadata, NOT visible on the image.
 *
 * @param imageBuffer - Raw image data
 * @param format - Image format (png, jpeg, webp)
 * @param config - Watermark configuration
 * @returns Watermarked image buffer
 */
export function embedImageWatermark(
  imageBuffer: Uint8Array,
  format: string = 'png',
  config: Partial<ImageWatermarkConfig> = {},
): Buffer {
  const fullConfig: ImageWatermarkConfig = {
    ...DEFAULT_WATERMARK,
    timestamp: Date.now(),
    ...config,
  };

  const normalizedFormat = format.toLowerCase().replace('image/', '');

  // Only watermark PNG for now (most common AI image output)
  if (normalizedFormat !== 'png') {
    return Buffer.from(imageBuffer);
  }

  // Verify it's actually a PNG
  if (!isPNG(imageBuffer)) {
    return Buffer.from(imageBuffer);
  }

  try {
    // Find IEND chunk position
    const iendPos = findIENDPosition(imageBuffer);
    if (iendPos === -1) {
      return Buffer.from(imageBuffer);
    }

    // Create watermark chunk
    const watermarkChunk = createiTXtChunk(fullConfig);

    // Insert chunk before IEND
    const beforeIEND = imageBuffer.subarray(0, iendPos);
    const iendAndAfter = imageBuffer.subarray(iendPos);

    const parts = [
      Buffer.from(beforeIEND),
      watermarkChunk,
      Buffer.from(iendAndAfter),
    ] as unknown as Uint8Array[];
    return Buffer.concat(parts);
  } catch {
    // On any error, return original image (safety first)
    return Buffer.from(imageBuffer);
  }
}

/**
 * Detect synthetic origin watermark from image
 *
 * @param imageBuffer - Image data to check
 * @returns Watermark info if found, null otherwise
 */
export function detectSyntheticImageWatermark(
  imageBuffer: Buffer,
): ImageWatermarkConfig | null {
  const bufferArray = new Uint8Array(imageBuffer);
  if (!isPNG(bufferArray) || imageBuffer.length < 20) {
    return null;
  }

  try {
    // Search for iTXt chunk type
    const itxtMarker = Buffer.from('iTXt');
    let pos = 8; // Start after PNG signature

    while (pos < imageBuffer.length - 12) {
      // Read chunk length (4 bytes)
      const chunkLength = imageBuffer.readUInt32BE(pos);
      const chunkType = imageBuffer.subarray(pos + 4, pos + 8).toString();

      if (chunkType === 'iTXt') {
        // Parse iTXt chunk data
        const chunkData = imageBuffer.subarray(pos + 8, pos + 8 + chunkLength);
        const chunkStr = chunkData.toString();

        // Check if it's our watermark chunk
        if (
          chunkStr.includes('SyntheticOrigin') &&
          chunkStr.includes('SYNTHETIC_IMAGE|')
        ) {
          const markerIdx = chunkStr.indexOf('SYNTHETIC_IMAGE|');
          const text = chunkStr.substring(markerIdx);
          const parts = text.split('|');

          if (parts.length >= 4) {
            return {
              platform: parts[1],
              source: parts[2],
              timestamp: parseInt(parts[3], 10),
              userIdHash: parts[4] || undefined,
              model: parts[5] || undefined,
            };
          }
        }
      }

      // Move to next chunk: length (4) + type (4) + data (chunkLength) + CRC (4)
      pos += 4 + 4 + chunkLength + 4;

      // Safety check
      if (chunkType === 'IEND') break;
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Convenience function for DALL-E generated images
 */
export function watermarkDallEImage(
  imageBuffer: Uint8Array,
  format: string = 'png',
  userIdHash?: string,
): Buffer {
  return embedImageWatermark(imageBuffer, format, {
    source: 'dalle',
    model: 'dall-e',
    userIdHash,
  });
}

/**
 * Convenience function for Gemini Imagen images
 */
export function watermarkGeminiImage(
  imageBuffer: Uint8Array,
  format: string = 'png',
  userIdHash?: string,
): Buffer {
  return embedImageWatermark(imageBuffer, format, {
    source: 'gemini',
    model: 'imagen',
    userIdHash,
  });
}

/**
 * Convenience function for Digital Twin generated images
 */
export function watermarkDigitalTwinImage(
  imageBuffer: Uint8Array,
  format: string = 'png',
  userIdHash?: string,
): Buffer {
  return embedImageWatermark(imageBuffer, format, {
    source: 'digital_twin',
    userIdHash,
  });
}

/**
 * Convenience function for Cyrano-generated images
 */
export function watermarkCyranoImage(
  imageBuffer: Uint8Array,
  format: string = 'png',
  userIdHash?: string,
): Buffer {
  return embedImageWatermark(imageBuffer, format, {
    source: 'cyrano',
    userIdHash,
  });
}
