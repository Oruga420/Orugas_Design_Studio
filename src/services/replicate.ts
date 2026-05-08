/**
 * Single image-generation client. Every supported model is routed through
 * the `/api/replicate` Vercel serverless proxy — no direct calls to vendor
 * SDKs from the browser. Per-model logic lives in `./models.ts`.
 */

import { MODELS, ReplicateModel, ModelManifest } from './models';

export type { ReplicateModel };

export interface ImageOptions {
  aspectRatio?: string;
  imageSize?: string;
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

function pickFromList(value: string | undefined, list: string[], fallback: string): string {
  if (value && list.includes(value)) return value;
  return list.includes(fallback) ? fallback : list[0];
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
  const slug: ReplicateModel = options.model || 'google/nano-banana-2';
  const manifest: ModelManifest = MODELS[slug];

  const finalPrompt = buildPrompt(prompt, options.advanced);
  const aspectRatio = pickFromList(options.aspectRatio, manifest.aspectRatios, '1:1');
  const resolution = pickFromList(options.imageSize, manifest.resolutions, '1K');
  const count = Math.max(1, Math.min(options.count || 1, manifest.maxBatch));

  const refs = manifest.supportsRefs && options.referenceImages
    ? options.referenceImages.slice(0, manifest.maxRefs)
    : [];
  const baseImage = manifest.supportsBaseImage ? options.baseImage : undefined;

  const buildCtx = {
    prompt: finalPrompt,
    aspectRatio,
    resolution,
    count,
    baseImage,
    referenceImages: refs,
  };

  if (manifest.fanOutClientSide && count > 1) {
    const results = await Promise.all(
      Array.from({ length: count }).map(() =>
        callReplicate(slug, manifest.buildInput({ ...buildCtx, count: 1 }))
      )
    );
    return { images: results.flat() };
  }

  const images = await callReplicate(slug, manifest.buildInput(buildCtx));
  return { images };
}
