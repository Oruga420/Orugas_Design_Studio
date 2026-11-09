<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Orugas Design Studio

Image generation app — every model is routed through Replicate via a Vercel serverless proxy. No vendor SDKs run in the browser.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set `REPLICATE_API_TOKEN` in `.env.local` to your Replicate API token. The token is read by the `/api/replicate` Vercel serverless function and never reaches the browser.
3. Run the app: `npm run dev`

## Models (all via Replicate)

- **Nano Banana 2 (Flash)** - `google/nano-banana-2` (Gemini 3.1 Flash Image)
- **Nano Banana 2.1** - `google/nano-banana-2.1`
- **Nano Banana Pro** - `google/nano-banana-pro` (Gemini 3 Pro Image)
- **Grok Imagine** - `xai/grok-imagine-image`
- **GPT Image 2** - `openai/gpt-image-2`
- **GPT Image 2.5 Flare** - `openai/gpt-image-2.5-flare`
- **GPT Image 2.5 Sunburst** - `openai/gpt-image-2.5-sunburst`
- **GPT Image 2.6 Flare** - `openai/gpt-image-2.6-flare`
- **GPT Image 2.6 Sunburst** - `openai/gpt-image-2.6-sunburst`

- **Krea 2 Medium** - `krea/krea-2-medium`
- **Krea 2 Large** - `krea/krea-2-large`
- **Krea 2 Medium Turbo** - `krea/krea-2-medium-turbo`

Nano Banana models (2, 2.1 and Pro) take up to 14 reference images and output
1K, 2K or 4K JPG. Each prediction returns one image, so a batch runs one
prediction per image. JPG keeps 2K and 4K results under the 4.5 MB response
limit of the Vercel function, which returns images base64-encoded.

Replicate model documentation: [Nano Banana 2.1](https://replicate.com/google/nano-banana-2.1).

GPT Image 2.5 models use the existing Replicate token and support text-to-image,
base-image editing, up to four reference images, batches of up to six images,
and seven aspect ratios. They reuse the GPT image payload with automatic quality
and WebP output. No additional API key is required.

Replicate model documentation: [Flare](https://replicate.com/openai/gpt-image-2.5-flare)
and [Sunburst](https://replicate.com/openai/gpt-image-2.5-sunburst).

GPT Image 2.6 models work like 2.5 (same token, editing, four references,
batches of six, seven aspect ratios, quality picker, low moderation, WebP
output) and add a **Complexity** picker: how much the model plans before it
renders. High (the default) suits dense text and complex layouts; Medium and
Low suit focused edits. Complexity does not change the price. Flare is the
fast one; Sunburst is for demanding detail, layout and edit accuracy.

Replicate model documentation: [Flare 2.6](https://replicate.com/openai/gpt-image-2.6-flare)
and [Sunburst 2.6](https://replicate.com/openai/gpt-image-2.6-sunburst).
