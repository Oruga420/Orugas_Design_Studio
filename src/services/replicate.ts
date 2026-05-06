/**
 * Single image-generation client. Every supported model is routed through
 * the `/api/replicate` Vercel serverless proxy — no direct calls to vendor
 * SDKs from the browser.
 */

export type ReplicateModel =
  | 'google/nano-banana-2'
  | 'google/nano-banana-pro'
  | 'google/imagen-4'
  | 'openai/gpt-image-2';

export interface ImageOptions {
  aspectRatio?: string;
  imageSize?: string; // "512" | "1K" | "2K" | "4K"
  count?: number;
  mode?: 'normal' | 'batch';
  referenceImages?: string[];
  baseImage?: string;
  model?: ReplicateModel;
  advanced?: {
    camera?: string;
    angle?: string;
    lighting?: string;
    filter?: string;
    style?: string;
  };
}

const NANO_BANANA_AR = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']);
const IMAGEN_AR = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
const GPT_IMAGE_AR = new Set(['1:1', '3:2', '2:3']);

function pickAspectRatio(ar: string | undefined, allowed: Set<string>, fallback: string): string {
  if (ar && allowed.has(ar)) return ar;
  if (!ar) return fallback;
  const [w, h] = ar.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return fallback;
  const ratio = w / h;
  if (ratio > 1.1) {
    if (allowed.has('16:9')) return '16:9';
    if (allowed.has('3:2')) return '3:2';
    if (allowed.has('4:3')) return '4:3';
  }
  if (ratio < 0.9) {
    if (allowed.has('9:16')) return '9:16';
    if (allowed.has('2:3')) return '2:3';
    if (allowed.has('3:4')) return '3:4';
  }
  return fallback;
}

function buildPrompt(prompt: string, advanced?: ImageOptions['advanced']): string {
  if (!advanced) return prompt;
  const parts: string[] = [];
  if (advanced.camera) parts.push(`Camera: ${advanced.camera}`);
  if (advanced.angle) parts.push(`Angle: ${advanced.angle}`);
  if (advanced.lighting) parts.push(`Lighting: ${advanced.lighting}`);
  if (advanced.filter) parts.push(`Filter: ${advanced.filter}`);
  if (advanced.style) parts.push(`Style: ${advanced.style}`);
  return parts.length ? `${prompt}. Technical details: ${parts.join(', ')}.` : prompt;
}

function mapResolution(size: string | undefined): '1K' | '2K' | '4K' {
  if (size === '2K') return '2K';
  if (size === '4K') return '4K';
  return '1K';
}

function buildInput(
  model: ReplicateModel,
  prompt: string,
  options: ImageOptions
): Record<string, unknown> {
  const refs: string[] = [];
  if (options.baseImage) refs.push(options.baseImage);
  if (options.referenceImages?.length) refs.push(...options.referenceImages);

  const count = Math.max(1, Math.min(options.count || 1, 6));

  if (model === 'google/nano-banana-2' || model === 'google/nano-banana-pro') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: pickAspectRatio(options.aspectRatio, NANO_BANANA_AR, '1:1'),
      output_resolution: mapResolution(options.imageSize),
      number_of_images: count,
      output_format: 'png',
    };
    if (refs.length) input.image_input = refs;
    return input;
  }

  if (model === 'google/imagen-4') {
    return {
      prompt,
      aspect_ratio: pickAspectRatio(options.aspectRatio, IMAGEN_AR, '1:1'),
      output_format: 'png',
      safety_filter_level: 'block_only_high',
    };
  }

  // openai/gpt-image-2
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: pickAspectRatio(options.aspectRatio, GPT_IMAGE_AR, '1:1'),
    quality: 'auto',
    number_of_images: count,
    output_format: 'webp',
    background: 'auto',
    moderation: 'auto',
  };
  if (refs.length) input.input_images = refs;
  return input;
}

async function callReplicate(
  model: ReplicateModel,
  input: Record<string, unknown>
): Promise<string[]> {
  const response = await fetch('/api/replicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  });

  const rawText = await response.text();
  let parsed: any = null;
  try { parsed = rawText ? JSON.parse(rawText) : null; } catch { /* keep rawText */ }

  if (!response.ok) {
    const base = parsed?.error || rawText || response.statusText;
    const logs = parsed?.logs ? ` — logs: ${String(parsed.logs).slice(0, 400)}` : '';
    throw new Error(`[Replicate proxy ${response.status}] ${base}${logs}`);
  }

  const images = Array.isArray(parsed?.images) ? parsed.images : [];
  if (images.length === 0) {
    throw new Error(`Replicate returned no images. Response: ${rawText.slice(0, 500)}`);
  }
  return images;
}

export async function generateImages(
  prompt: string,
  options: ImageOptions = {}
): Promise<{ images: string[] }> {
  const model: ReplicateModel = options.model || 'google/nano-banana-2';
  const finalPrompt = buildPrompt(prompt, options.advanced);

  // Imagen 4 has no batch param — fan out client-side.
  if (model === 'google/imagen-4') {
    const count = Math.max(1, Math.min(options.count || 1, 6));
    const results = await Promise.all(
      Array.from({ length: count }).map(() =>
        callReplicate(model, buildInput(model, finalPrompt, options))
      )
    );
    return { images: results.flat() };
  }

  const images = await callReplicate(model, buildInput(model, finalPrompt, options));
  return { images };
}
