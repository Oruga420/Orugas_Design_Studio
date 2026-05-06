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

- **Nano Banana 2 (Flash)** — `google/nano-banana-2` (Gemini 3.1 Flash Image)
- **Nano Banana Pro** — `google/nano-banana-pro` (Gemini 3 Pro Image)
- **Imagen 4** — `google/imagen-4`
- **GPT Image 2** — `openai/gpt-image-2`
