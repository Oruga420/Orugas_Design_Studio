<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f0d3866e-3df0-4446-b093-db1496599780

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional) Set `REPLICATE_API_TOKEN` in [.env.local](.env.local) to enable the `openai/gpt-image-2` model via Replicate. The token is read by the `/api/replicate` Vercel serverless function and never reaches the browser.
4. Run the app:
   `npm run dev`

## Models

- **Nano Banana 2 (Flash)** — `gemini-3.1-flash-image-preview`
- **Nano Banana Pro** — `gemini-3-pro-image-preview`
- **Imagen 4** — `imagen-4.0-generate-001`
- **GPT Image 2** — `openai/gpt-image-2` via Replicate (requires `REPLICATE_API_TOKEN`)
