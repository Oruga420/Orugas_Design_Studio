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
  | 'openai/gpt-image-2'
  | 'openai/gpt-image-2.5-flare'
  | 'openai/gpt-image-2.5-sunburst'
  | 'krea/krea-2-medium'
  | 'krea/krea-2-large'
  | 'krea/krea-2-medium-turbo';

export interface ModelInputContext {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  count: number;
  baseImage?: string;
  referenceImages: string[];
  seed?: number;
  negativePrompt?: string;
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
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
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
const GPT_IMAGE_25_AR = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'];
const KREA_AR = ['1:1', '4:3', '3:2', '16:9', '2.35:1', '4:5', '2:3', '9:16'];

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
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
  return input;
}

function imagenInput(ctx: ModelInputContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    output_format: 'png',
    safety_filter_level: 'block_only_high',
  };
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
  return input;
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
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
  if (ctx.negativePrompt) input.negative_prompt = ctx.negativePrompt;
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
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
  if (ctx.negativePrompt) input.negative_prompt = ctx.negativePrompt;
  return input;
}

function grokInput(ctx: ModelInputContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
  };
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
  return input;
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

function kreaInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
  };
  // Krea 2 transfers the *style* of reference images (max 10). The Replicate
  // schema has no img2img base, negative prompt, resolution, output_format, or
  // batch field. Image size is governed solely by aspect_ratio, and
  // `creativity` is left to each variant's own default by omitting it.
  if (refs.length) input.style_reference_images = refs.slice(0, 10);
  if (typeof ctx.seed === 'number') input.seed = ctx.seed;
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
    supportsSeed: true,
    supportsNegativePrompt: false,
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
    supportsSeed: true,
    supportsNegativePrompt: false,
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
    supportsSeed: true,
    supportsNegativePrompt: false,
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
    supportsSeed: true,
    supportsNegativePrompt: false,
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
    supportsSeed: true,
    supportsNegativePrompt: true,
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
    supportsSeed: true,
    supportsNegativePrompt: true,
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
    supportsSeed: true,
    supportsNegativePrompt: true,
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
    supportsSeed: true,
    supportsNegativePrompt: false,
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
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImageInput,
  },
  'openai/gpt-image-2.5-flare': {
    slug: 'openai/gpt-image-2.5-flare',
    label: 'GPT Image 2.5 Flare',
    description: 'OpenAI via Replicate. Fast generation and precise edits.',
    aspectRatios: GPT_IMAGE_25_AR,
    resolutions: ['1K'],
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImageInput,
  },
  'openai/gpt-image-2.5-sunburst': {
    slug: 'openai/gpt-image-2.5-sunburst',
    label: 'GPT Image 2.5 Sunburst',
    description: 'OpenAI via Replicate. Extra precision for detailed creative work.',
    aspectRatios: GPT_IMAGE_25_AR,
    resolutions: ['1K'],
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImageInput,
  },
  'krea/krea-2-medium': {
    slug: 'krea/krea-2-medium',
    label: 'Krea 2 Medium',
    description: 'Krea 2. Balanced quality + speed, style refs.',
    aspectRatios: KREA_AR,
    resolutions: ['1K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 10,
    supportsBaseImage: false,
    supportsSeed: true,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
    buildInput: kreaInput,
  },
  'krea/krea-2-large': {
    slug: 'krea/krea-2-large',
    label: 'Krea 2 Large',
    description: 'Krea 2 flagship. Highest quality, style refs.',
    aspectRatios: KREA_AR,
    resolutions: ['1K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 10,
    supportsBaseImage: false,
    supportsSeed: true,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
    buildInput: kreaInput,
  },
  'krea/krea-2-medium-turbo': {
    slug: 'krea/krea-2-medium-turbo',
    label: 'Krea 2 Medium Turbo',
    description: 'Krea 2 fastest. Speed-optimized, style refs.',
    aspectRatios: KREA_AR,
    resolutions: ['1K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 10,
    supportsBaseImage: false,
    supportsSeed: true,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
    buildInput: kreaInput,
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
  MODELS['openai/gpt-image-2.5-flare'],
  MODELS['openai/gpt-image-2.5-sunburst'],
  MODELS['krea/krea-2-medium'],
  MODELS['krea/krea-2-large'],
  MODELS['krea/krea-2-medium-turbo'],
];

export function getModel(slug: ReplicateModel): ModelManifest {
  return MODELS[slug];
}
