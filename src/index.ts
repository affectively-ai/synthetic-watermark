/**
 * @affectively/synthetic-watermark
 *
 * Invisible watermarking for AI-generated content.
 * Embeds synthetic origin markers into PNG images and MP3 audio files.
 *
 * @example
 * ```typescript
 * import {
 *   embedImageWatermark,
 *   detectSyntheticImageWatermark,
 *   embedAudioWatermark,
 *   detectSyntheticWatermark
 * } from '@affectively/synthetic-watermark';
 *
 * // Watermark an AI-generated image
 * const watermarkedImage = embedImageWatermark(pngBuffer, 'png', {
 *   source: 'dalle',
 *   model: 'dall-e-3',
 * });
 *
 * // Detect watermark
 * const detected = detectSyntheticImageWatermark(watermarkedImage);
 * // { platform: 'AFFECTIVELY', source: 'dalle', timestamp: 1234567890 }
 *
 * // Watermark AI-generated audio
 * const watermarkedAudio = embedAudioWatermark(mp3Buffer, 'mp3', {
 *   source: 'tts',
 * });
 * ```
 */

// Image watermarking
export {
  embedImageWatermark,
  detectSyntheticImageWatermark,
  watermarkDallEImage,
  watermarkGeminiImage,
  watermarkDigitalTwinImage,
  watermarkCyranoImage,
} from './imageWatermark';

export type { ImageWatermarkConfig } from './imageWatermark';

// Audio watermarking
export {
  embedAudioWatermark,
  detectSyntheticWatermark,
  watermarkDigitalTwinAudio,
  watermarkHologramAudio,
  watermarkCyranoAudio,
} from './audioWatermark';

export type { WatermarkConfig } from './audioWatermark';
