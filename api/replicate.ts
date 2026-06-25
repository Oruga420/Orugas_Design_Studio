/**
 * Vercel serverless function — proxies requests to the Replicate API.
 * Keeps REPLICATE_API_TOKEN server-side and avoids browser CORS issues.
 *
 * Generic by design: forwards any whitelisted model slug + arbitrary `input`
 * payload to Replicate's `/v1/models/{slug}/predictions` endpoint, polls until
 * completion, and returns output images as base64 data URLs.
 */

const ALLOWED_MODELS = new Set([
  'google/nano-banana-2',
  'google/nano-banana-pro',
  'google/imagen-4',
  'google/imagen-4-ultra',
  'black-forest-labs/flux-2-max',
  'black-forest-labs/flux-2-pro',
  'bytedance/seedream-5-lite',
  'xai/grok-imagine-image',
  'openai/gpt-image-2',
  'krea/krea-2-medium',
  'krea/krea-2-large',
  'krea/krea-2-medium-turbo',
]);

type RequestBody = {
  model?: string;
  input: Record<string, unknown>;
};

type VercelRequest = {
  method?: string;
  body: RequestBody | string | undefined;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });
    return;
  }

  let parsed: RequestBody;
  try {
    parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as RequestBody;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const modelPath = parsed?.model;
  if (!modelPath || !ALLOWED_MODELS.has(modelPath)) {
    res.status(400).json({
      error: `Unsupported model. Allowed: ${[...ALLOWED_MODELS].join(', ')}`,
    });
    return;
  }

  if (!parsed?.input || typeof parsed.input !== 'object') {
    res.status(400).json({ error: 'Missing input object' });
    return;
  }

  const promptValue = (parsed.input as { prompt?: unknown }).prompt;
  if (typeof promptValue !== 'string' || !promptValue.trim()) {
    res.status(400).json({ error: 'Missing input.prompt' });
    return;
  }

  try {
    const createResp = await fetch(
      `https://api.replicate.com/v1/models/${modelPath}/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({ input: parsed.input }),
      }
    );

    const rawText = await createResp.text();
    let prediction: any = null;
    try { prediction = rawText ? JSON.parse(rawText) : null; } catch { /* keep rawText */ }

    if (!createResp.ok) {
      const msg = prediction?.detail || prediction?.error || rawText || createResp.statusText;
      res.status(createResp.status).json({
        error: `Replicate ${createResp.status}: ${msg}`,
        model: modelPath,
        replicate: prediction || rawText,
      });
      return;
    }

    const finalPrediction = prediction?.status === 'succeeded' || prediction?.status === 'failed'
      ? prediction
      : await pollPrediction(prediction.id, token);

    if (finalPrediction.status !== 'succeeded') {
      const errDetail = typeof finalPrediction.error === 'string'
        ? finalPrediction.error
        : JSON.stringify(finalPrediction.error || finalPrediction);
      res.status(502).json({
        error: `Prediction ${finalPrediction.status}: ${errDetail}`,
        logs: finalPrediction.logs,
        replicate: finalPrediction,
      });
      return;
    }

    const outputs = normalizeOutputs(finalPrediction.output);
    const images = await Promise.all(outputs.map((url) => fetchAsDataUrl(url)));

    res.status(200).json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}

function normalizeOutputs(output: unknown): string[] {
  if (!output) return [];
  if (typeof output === 'string') return [output];
  if (Array.isArray(output)) {
    return output.flatMap((item) =>
      typeof item === 'string' ? [item] : []
    );
  }
  if (typeof output === 'object') {
    const maybeImages = (output as { images?: unknown }).images;
    if (Array.isArray(maybeImages)) {
      return maybeImages.flatMap((item) =>
        typeof item === 'string' ? [item] : []
      );
    }
  }
  return [];
}

async function pollPrediction(id: string, token: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const resp = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.json();
    if (body.status === 'succeeded' || body.status === 'failed' || body.status === 'canceled') {
      return body;
    }
  }
  throw new Error('Prediction timed out after 120s');
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch output image: ${resp.status}`);
  const contentType = resp.headers.get('content-type') || 'image/webp';
  const buffer = Buffer.from(await resp.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
