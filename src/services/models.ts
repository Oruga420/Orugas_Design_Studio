/**
 * Central manifest of every supported image-generation model.
 *
 * Single source of truth for: UI labels, dropdown order, allowed aspect
 * ratios / resolutions, batch limits, reference-image support, and the
 * function that builds the Replicate `input` payload for the model.
 */

export type ReplicateModel =
  | 'google/nano-banana-2'
  | 'google/nano-banana-2.1'
  | 'google/nano-banana-pro'
  | 'xai/grok-imagine-image'
  | 'openai/gpt-image-2'
  | 'openai/gpt-image-2.5-flare'
  | 'openai/gpt-image-2.5-sunburst'
  | 'openai/gpt-image-2.6-flare'
  | 'openai/gpt-image-2.6-sunburst'
  | 'krea/krea-2-medium'
  | 'krea/krea-2-large'
  | 'krea/krea-2-medium-turbo';

export const GPT_IMAGE_25_QUALITIES = ['max', 'xhigh', 'high', 'medium', 'low'] as const;
export type ImageQuality = typeof GPT_IMAGE_25_QUALITIES[number];
export const DEFAULT_IMAGE_QUALITY: ImageQuality = 'medium';

// GPT Image 2.6 adds `complexity`: how much the model plans before it renders.
// It does not change the price. 'high' is the Replicate default.
export const GPT_IMAGE_26_COMPLEXITIES = ['high', 'medium', 'low'] as const;
export type ImageComplexity = typeof GPT_IMAGE_26_COMPLEXITIES[number];
export const DEFAULT_IMAGE_COMPLEXITY: ImageComplexity = 'high';

export interface ModelInputContext {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  quality?: ImageQuality;
  complexity?: ImageComplexity;
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
  qualities?: readonly ImageQuality[];
  complexities?: readonly ImageComplexity[];
  maxBatch: number;
  supportsRefs: boolean;
  maxRefs: number;
  supportsBaseImage: boolean;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  /**
   * Some models (like Nano Banana and Krea) accept only one image per
   * prediction; the client must fan out client-side. Set this true to opt
   * into client-side fan-out instead of passing a batch size to the model.
   */
  fanOutClientSide?: boolean;
  buildInput: (ctx: ModelInputContext) => Record<string, unknown>;
}

const NANO_BANANA_AR = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const GROK_AR = ['1:1', '16:9', '9:16'];
const GPT_IMAGE_AR = ['1:1', '3:2', '2:3'];
const GPT_IMAGE_25_AR = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'];
const KREA_AR = ['1:1', '4:3', '3:2', '16:9', '2.35:1', '4:5', '2:3', '9:16'];

function nanoBananaInput(ctx: ModelInputContext): Record<string, unknown> {
  const refs = collectRefs(ctx);
  // Replicate schema (nano-banana-2, 2.1, pro): prompt, image_input,
  // aspect_ratio, resolution, output_format. One image per prediction (batches
  // fan out client-side) and no seed. JPG keeps 2K/4K results under Vercel's
  // 4.5 MB response limit once base64-encoded; a 2K PNG does not fit.
  const input: Record<string, unknown> = {
    prompt: ctx.prompt,
    aspect_ratio: ctx.aspectRatio,
    resolution: ctx.resolution,
    output_format: 'jpg',
  };
  if (refs.length) input.image_input = refs;
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

function gptImage25Input(ctx: ModelInputContext): Record<string, unknown> {
  const quality = GPT_IMAGE_25_QUALITIES.includes(ctx.quality as ImageQuality)
    ? ctx.quality
    : DEFAULT_IMAGE_QUALITY;
  // 'low' is the API's least restrictive supported moderation setting.
  return { ...gptImageInput(ctx), quality, moderation: 'low' };
}

function gptImage26Input(ctx: ModelInputContext): Record<string, unknown> {
  const complexity = GPT_IMAGE_26_COMPLEXITIES.includes(ctx.complexity as ImageComplexity)
    ? ctx.complexity
    : DEFAULT_IMAGE_COMPLEXITY;
  // Same payload as 2.5 (quality, low moderation, WebP) plus the new field.
  return { ...gptImage25Input(ctx), complexity };
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
    supportsSeed: false,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
    buildInput: nanoBananaInput,
  },
  'google/nano-banana-2.1': {
    slug: 'google/nano-banana-2.1',
    label: 'Nano Banana 2.1',
    description: 'Newest fast Google model. Sharper output and text than 2, up to 4K.',
    aspectRatios: NANO_BANANA_AR,
    resolutions: ['1K', '2K', '4K'],
    maxBatch: 4,
    supportsRefs: true,
    maxRefs: 14,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
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
    supportsSeed: false,
    supportsNegativePrompt: false,
    fanOutClientSide: true,
    buildInput: nanoBananaInput,
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
    qualities: GPT_IMAGE_25_QUALITIES,
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImage25Input,
  },
  'openai/gpt-image-2.5-sunburst': {
    slug: 'openai/gpt-image-2.5-sunburst',
    label: 'GPT Image 2.5 Sunburst',
    description: 'OpenAI via Replicate. Extra precision for detailed creative work.',
    aspectRatios: GPT_IMAGE_25_AR,
    resolutions: ['1K'],
    qualities: GPT_IMAGE_25_QUALITIES,
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImage25Input,
  },
  'openai/gpt-image-2.6-flare': {
    slug: 'openai/gpt-image-2.6-flare',
    label: 'GPT Image 2.6 Flare',
    description: 'OpenAI via Replicate. Newest fast model for generation and edits, with complexity control.',
    aspectRatios: GPT_IMAGE_25_AR,
    resolutions: ['1K'],
    qualities: GPT_IMAGE_25_QUALITIES,
    complexities: GPT_IMAGE_26_COMPLEXITIES,
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImage26Input,
  },
  'openai/gpt-image-2.6-sunburst': {
    slug: 'openai/gpt-image-2.6-sunburst',
    label: 'GPT Image 2.6 Sunburst',
    description: 'OpenAI via Replicate. Newest detail model for demanding layouts and edits, with complexity control.',
    aspectRatios: GPT_IMAGE_25_AR,
    resolutions: ['1K'],
    qualities: GPT_IMAGE_25_QUALITIES,
    complexities: GPT_IMAGE_26_COMPLEXITIES,
    maxBatch: 6,
    supportsRefs: true,
    maxRefs: 4,
    supportsBaseImage: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    buildInput: gptImage26Input,
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
  MODELS['google/nano-banana-2.1'],
  MODELS['google/nano-banana-pro'],
  MODELS['xai/grok-imagine-image'],
  MODELS['openai/gpt-image-2'],
  MODELS['openai/gpt-image-2.5-flare'],
  MODELS['openai/gpt-image-2.5-sunburst'],
  MODELS['openai/gpt-image-2.6-flare'],
  MODELS['openai/gpt-image-2.6-sunburst'],
  MODELS['krea/krea-2-medium'],
  MODELS['krea/krea-2-large'],
  MODELS['krea/krea-2-medium-turbo'],
];

export function getModel(slug: ReplicateModel): ModelManifest {
  return MODELS[slug];
}
