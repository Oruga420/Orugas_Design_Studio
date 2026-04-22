/**
 * Vercel serverless function — proxies requests to the Replicate API.
 * Keeps REPLICATE_API_TOKEN server-side and avoids browser CORS issues.
 */

type ReplicateInput = {
  prompt: string;
  aspect_ratio?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  number_of_images?: number;
  output_format?: 'webp' | 'png' | 'jpeg';
  background?: 'auto' | 'opaque';
  moderation?: 'auto' | 'low';
  input_images?: string[];
};

type RequestBody = {
  model?: string;
  input: ReplicateInput;
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

const DEFAULT_MODEL = 'openai/gpt-image-2';

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

  if (!parsed?.input?.prompt) {
    res.status(400).json({ error: 'Missing input.prompt' });
    return;
  }

  const modelPath = parsed.model || DEFAULT_MODEL;

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

    const outputs = Array.isArray(finalPrediction.output)
      ? finalPrediction.output
      : finalPrediction.output
        ? [finalPrediction.output]
        : [];

    const images = await Promise.all(
      outputs.map((url: string) => fetchAsDataUrl(url))
    );

    res.status(200).json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
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
