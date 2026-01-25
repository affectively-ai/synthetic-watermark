# @affectively/synthetic-watermark

Invisible watermarking for AI-generated content. Embeds synthetic origin markers into PNG images and MP3 audio files for authenticity verification and AI safety compliance.

## Features

- **Image Watermarking** - Embeds invisible metadata into PNG files using iTXt chunks
- **Audio Watermarking** - Embeds metadata into MP3 files using ID3v2 tags
- **Detection** - Verify if content has synthetic origin markers
- **Zero Dependencies** - Uses only Node.js Buffer API
- **Non-Destructive** - Watermarks are stored in metadata, not visible/audible content
- **AI Safety** - Helps identify AI-generated content for authenticity verification

## Installation

```bash
npm install @affectively/synthetic-watermark
# or
bun add @affectively/synthetic-watermark
# or
yarn add @affectively/synthetic-watermark
```

## Quick Start

### Image Watermarking

```typescript
import {
  embedImageWatermark,
  detectSyntheticImageWatermark,
} from '@affectively/synthetic-watermark';

// Watermark an AI-generated image
const pngBuffer = await fs.readFile('ai-generated-image.png');
const watermarkedImage = embedImageWatermark(pngBuffer, 'png', {
  source: 'dalle',
  model: 'dall-e-3',
  platform: 'MyApp',
});

// Save the watermarked image
await fs.writeFile('watermarked-image.png', watermarkedImage);

// Detect watermark
const detected = detectSyntheticImageWatermark(watermarkedImage);
if (detected) {
  console.log('Synthetic origin detected:', detected);
  // { platform: 'MyApp', source: 'dalle', model: 'dall-e-3', timestamp: 1234567890 }
}
```

### Audio Watermarking

```typescript
import {
  embedAudioWatermark,
  detectSyntheticWatermark,
} from '@affectively/synthetic-watermark';

// Watermark AI-generated audio
const mp3Buffer = await fs.readFile('tts-audio.mp3');
const watermarkedAudio = embedAudioWatermark(mp3Buffer, 'mp3', {
  source: 'tts',
  platform: 'MyApp',
});

// Save the watermarked audio
await fs.writeFile('watermarked-audio.mp3', watermarkedAudio);

// Detect watermark
const detected = detectSyntheticWatermark(watermarkedAudio);
if (detected) {
  console.log('Synthetic audio detected:', detected);
  // { platform: 'MyApp', source: 'tts', timestamp: 1234567890 }
}
```

## Convenience Functions

### For Images

```typescript
import {
  watermarkDallEImage,
  watermarkGeminiImage,
  watermarkDigitalTwinImage,
  watermarkCyranoImage,
} from '@affectively/synthetic-watermark';

// Pre-configured for specific AI image generators
const watermarked = watermarkDallEImage(imageBuffer, 'png', optionalUserIdHash);
```

### For Audio

```typescript
import {
  watermarkDigitalTwinAudio,
  watermarkHologramAudio,
  watermarkCyranoAudio,
} from '@affectively/synthetic-watermark';

// Pre-configured for specific TTS systems
const watermarked = watermarkCyranoAudio(audioBuffer, 'mp3');
```

## Watermark Format

### Image Watermark (PNG iTXt chunk)

```
SyntheticOrigin: SYNTHETIC_IMAGE|platform|source|timestamp|userIdHash|model
```

### Audio Watermark (ID3v2 COMM frame)

```
SYNTHETIC_ORIGIN: SYNTHETIC_AUDIO|platform|source|timestamp|userIdHash
```

## API Reference

### Image Functions

#### `embedImageWatermark(buffer, format, config?)`

Embeds an invisible watermark into a PNG image.

- `buffer` - Image data (Uint8Array)
- `format` - Image format (currently only 'png' supported)
- `config` - Optional configuration:
  - `platform` - Platform identifier (default: 'SYNTHETIC')
  - `source` - Source system (e.g., 'dalle', 'gemini')
  - `model` - Model name (e.g., 'dall-e-3')
  - `userIdHash` - Hashed user ID for audit trail

Returns: Watermarked image buffer

#### `detectSyntheticImageWatermark(buffer)`

Detects and extracts watermark from PNG image.

Returns: `ImageWatermarkConfig | null`

### Audio Functions

#### `embedAudioWatermark(buffer, format, config?)`

Embeds an invisible watermark into MP3 audio.

- `buffer` - Audio data (Buffer)
- `format` - Audio format (currently only 'mp3' supported)
- `config` - Optional configuration:
  - `platform` - Platform identifier (default: 'SYNTHETIC')
  - `source` - Source system (e.g., 'tts', 'hologram')
  - `userIdHash` - Hashed user ID for audit trail

Returns: Watermarked audio buffer

#### `detectSyntheticWatermark(buffer)`

Detects and extracts watermark from MP3 audio.

Returns: `WatermarkConfig | null`

## Use Cases

1. **AI Safety Compliance** - Mark AI-generated content for authenticity verification
2. **Content Authentication** - Verify the origin of synthetic media
3. **Audit Trail** - Track when and by whom content was generated
4. **Platform Trust** - Help users identify AI-generated content
5. **Regulatory Compliance** - Support emerging AI content disclosure requirements

## Technical Details

### PNG Watermarking

- Uses iTXt (International Text) chunk per PNG specification
- Inserted before IEND chunk
- Includes proper CRC32 checksum
- Non-destructive to image data

### MP3 Watermarking

- Uses ID3v2.3 COMM (Comment) frame
- Replaces existing ID3 tag if present
- Syncsafe integer encoding for size
- Compatible with standard ID3 readers

## Browser Support

Works in Node.js and browser environments (requires Buffer polyfill in browser).

## License

MIT © AFFECTIVELY
