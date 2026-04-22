/**
 * Client for Replicate-hosted image models, routed through the
 * `/api/replicate` Vercel serverless function to keep the API token
 * server-side and avoid browser CORS.
 */

export type ReplicateModel = 'openai/gpt-image-2';

export interface ReplicateImageOptions {
  aspectRatio?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  count?: number;
  outputFormat?: 'webp' | 'png' | 'jpeg';
  background?: 'auto' | 'opaque';
  moderation?: 'auto' | 'low';
  inputImages?: string[]; // data URLs or https URLs
}

const SUPPORTED_ASPECT_RATIOS = new Set(['1:1', '3:2', '2:3']);

function normalizeAspectRatio(ar?: string): '1:1' | '3:2' | '2:3' {
  if (ar && SUPPORTED_ASPECT_RATIOS.has(ar)) {
    return ar as '1:1' | '3:2' | '2:3';
  }
  if (!ar) return '1:1';
  // Best-effort fallback: map wide to 3:2, tall to 2:3, else square.
  const [w, h] = ar.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return '1:1';
  const ratio = w / h;
  if (ratio > 1.1) return '3:2';
  if (ratio < 0.9) return '2:3';
  return '1:1';
}

export async function generateWithReplicate(
  prompt: string,
  model: ReplicateModel,
  options: ReplicateImageOptions = {}
): Promise<{ images: string[] }> {
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: normalizeAspectRatio(options.aspectRatio),
    quality: options.quality || 'auto',
    number_of_images: Math.max(1, Math.min(options.count || 1, 10)),
    output_format: options.outputFormat || 'webp',
    background: options.background || 'auto',
    moderation: options.moderation || 'auto',
  };

  if (options.inputImages && options.inputImages.length > 0) {
    input.input_images = options.inputImages;
  }

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
    throw new Error(
      `Replicate returned no images. Response: ${rawText.slice(0, 500)}`
    );
  }
  return { images };
}
