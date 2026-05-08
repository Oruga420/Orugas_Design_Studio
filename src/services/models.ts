/**
 * Central manifest of every supported image-generation model.
 *
 * Single source of truth for: UI labels, dropdown order, allowed aspect
 * ratios / resolutions, batch limits, reference-image support, and the
 * function that builds the Replicate `input` payload for the model.
 */

export type ReplicateModel =
  | 'google/nano-banana-2'
  | 'google/nano-banana-pro'
  | 'google/imagen-4'
  | 'google/imagen-4-ultra'
  | 'black-forest-labs/flux-2-max'
  | 'black-forest-labs/flux-2-pro'
  | 'bytedance/seedream-5-lite'
  | 'xai/grok-imagine-image'
  | 'openai/gpt-image-2';

export interface ModelInputContext {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  count: number;
  baseImage?: string;
  referenceImages: string[];
}

export interface ModelManifest {
  slug: ReplicateModel;
  label: string;
  description: string;
  aspectRatios: string[];
  resolutions: string[];
  maxBatch: number;
  supportsRefs: boolean;
  maxRefs: number;
  supportsBaseImage: boolean;
  /**
   * Some models (like Imagen) accept only one image per prediction; the
   * client must fan out client-side. Set this true to opt into client-side
   * fan-out instead of passing `number_of_images` to the model.
   */
  fanOutClientSide?: boolean;
  buildInput: (ctx: ModelInputContext) => Record<string, unknown>;
}

const NANO_BANANA_AR = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const IMAGEN_AR = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const FLUX_AR = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21'];
const SEEDREAM_AR = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'];
const GROK_AR = ['1:1', '16:9', '9:16'];
const GPT_IMAGE_AR = ['1:1', '3:2', '2:3'];

function nanoBananaInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    output_resolution: ctx.resolution,
    number_of_images: ctx.count,
    output_format: 'png',
  };
  if (refs.length) input.image_input = refs;
  return input;
}

function imagenInput(ctx: ModelInputContext): Record<string, unknown> {
  return {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    output_format: 'png',
    safety_filter_level: 'block_only_high',
  };
}

function fluxInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    num_outputs: ctx.count,
    output_format: 'png',
  };
  if (refs.length) input.image_prompt = refs[0];
  return input;
}

function seedreamInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    num_outputs: ctx.count,
    output_format: 'png',
  };
  if (refs.length) input.image_input = refs;
  return input;
}

function grokInput(ctx: ModelInputContext): Record<string, unknown> {
  return {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
  };
}

function gptImageInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    quality: 'auto',
    number_of_images: ctx.count,
    output_format: 'webp',
    background: 'auto',
    moderation: 'auto',
  };
  if (refs.length) input.input_images = refs;
  return input;
}

function collectRefs(ctx: ModelInputContext): string[] {
  const refs: string[] = [];
  if (ctx.baseImage) refs.push(ctx.baseImage);
  if (ctx.referenceImages?.length) refs.push(...ctx.referenceImages);
  return refs;
}

export const MODELS: Record<ReplicateModel, ModelManifest> = {
  'google/nano-banana-2': {
    slug: 'google/nano-banana-2',
    label: 'Nano Banana 2 (Flash)',
    description: 'Gemini 3.1 Flash Image. Fast, high-volume.',
    aspectRatios: NANO_BANANA_AR,
    resolutions: ['1K', '2K', '4K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 14,
    supportsBaseImage: true,
    buildInput: nanoBananaInput,
  },
  'google/nano-banana-pro': {
    slug: 'google/nano-banana-pro',
    label: 'Nano Banana Pro',
    description: 'Gemini 3 Pro Image. Highest fidelity Google model, up to 4K.',
    aspectRatios: NANO_BANANA_AR,
    resolutions: ['1K', '2K', '4K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 14,
    supportsBaseImage: true,
    buildInput: nanoBananaInput,
  },
  'google/imagen-4': {
    slug: 'google/imagen-4',
    label: 'Imagen 4',
    description: 'Google photorealism. Single image per call.',
    aspectRatios: IMAGEN_AR,
    resolutions: ['1K', '2K'],
    maxBatch: 6,
    supportsRefs: false,
    maxRefs: 0,
    supportsBaseImage: false,
    fanOutClientSide: true,
    buildInput: imagenInput,
  },
  'google/imagen-4-ultra': {
    slug: 'google/imagen-4-ultra',
    label: 'Imagen 4 Ultra',
    description: 'Highest-quality Imagen. Quality over speed/cost.',
    aspectRatios: IMAGEN_AR,
    resolutions: ['1K', '2K'],
    maxBatch: 4,
    supportsRefs: false,
    maxRefs: 0,
    supportsBaseImage: false,
    fanOutClientSide: true,
    buildInput: imagenInput,
  },
  'black-forest-labs/flux-2-max': {
    slug: 'black-forest-labs/flux-2-max',
    label: 'FLUX 2 Max',
    description: 'BFL flagship. Top quality, ref support.',
    aspectRatios: FLUX_AR,
    resolutions: ['1K', '2K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 8,
    supportsBaseImage: true,
    buildInput: fluxInput,
  },
  'black-forest-labs/flux-2-pro': {
    slug: 'black-forest-labs/flux-2-pro',
    label: 'FLUX 2 Pro',
    description: 'BFL balanced. Quality + speed.',
    aspectRatios: FLUX_AR,
    resolutions: ['1K', '2K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 8,
    supportsBaseImage: true,
    buildInput: fluxInput,
  },
  'bytedance/seedream-5-lite': {
    slug: 'bytedance/seedream-5-lite',
    label: 'Seedream 5 Lite',
    description: 'ByteDance. Fast, ref support, edits.',
    aspectRatios: SEEDREAM_AR,
    resolutions: ['1K', '2K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    buildInput: seedreamInput,
  },
  'xai/grok-imagine-image': {
    slug: 'xai/grok-imagine-image',
    label: 'Grok Imagine',
    description: 'xAI image model. Text-to-image only.',
    aspectRatios: GROK_AR,
    resolutions: ['1K'],
    maxBatch: 1,
    supportsRefs: false,
    maxRefs: 0,
    supportsBaseImage: false,
    buildInput: grokInput,
  },
  'openai/gpt-image-2': {
    slug: 'openai/gpt-image-2',
    label: 'GPT Image 2',
    description: 'OpenAI via Replicate. Strong text rendering, edits.',
    aspectRatios: GPT_IMAGE_AR,
    resolutions: ['1K'],
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    buildInput: gptImageInput,
  },
};

export const MODEL_LIST: ModelManifest[] = [
  MODELS['google/nano-banana-2'],
  MODELS['google/nano-banana-pro'],
  MODELS['google/imagen-4'],
  MODELS['google/imagen-4-ultra'],
  MODELS['black-forest-labs/flux-2-max'],
  MODELS['black-forest-labs/flux-2-pro'],
  MODELS['bytedance/seedream-5-lite'],
  MODELS['xai/grok-imagine-image'],
  MODELS['openai/gpt-image-2'],
];

export function getModel(slug: ReplicateModel): ModelManifest {
  return MODELS[slug];
}
