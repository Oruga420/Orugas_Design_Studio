import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export interface ImageOptions {
  aspectRatio?: string;
  imageSize?: string;
  count?: number;
  mode?: 'normal' | 'batch';
  referenceImages?: string[]; // Array of base64 strings
  baseImage?: string; // For editing
  useSearch?: boolean;
  useImageSearch?: boolean;
  thinkingLevel?: 'Minimal' | 'High';
  includeThoughts?: boolean;
  model?: 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview';
  advanced?: {
    camera?: string;
    angle?: string;
    lighting?: string;
    filter?: string;
    style?: string;
  };
}

export async function generateImages(
  prompt: string, 
  options: ImageOptions = {}
): Promise<{ images: string[], thoughts?: string[] }> {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY) as string;
  const ai = new GoogleGenAI({ apiKey });
  
  const modelName = options.model || 'gemini-3.1-flash-image-preview';
  const count = options.count || 1;
  const isEditing = !!options.baseImage;
  const isImagen = modelName.startsWith('imagen-') && !isEditing;
  
  let finalPrompt = prompt;
  if (options.advanced) {
    const { camera, angle, lighting, filter, style } = options.advanced;
    const additions = [];
    if (camera) additions.push(`Camera: ${camera}`);
    if (angle) additions.push(`Angle: ${angle}`);
    if (lighting) additions.push(`Lighting: ${lighting}`);
    if (filter) additions.push(`Filter: ${filter}`);
    if (style) additions.push(`Style: ${style}`);
    
    if (additions.length > 0) {
      finalPrompt = `${prompt}. Technical details: ${additions.join(", ")}.`;
    }
  }

  if (isImagen && options.mode === 'batch') {
    const response = await ai.models.generateImages({
      model: modelName,
      prompt: finalPrompt,
      config: {
        numberOfImages: count,
        aspectRatio: (options.aspectRatio as any) || '1:1',
        outputMimeType: 'image/png'
      }
    });
    const images = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
    return { images, thoughts: [] };
  }

  const generateSingle = async (index: number) => {
    try {
      if (isImagen) {
        const response = await ai.models.generateImages({
          model: modelName,
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: (options.aspectRatio as any) || '1:1',
            outputMimeType: 'image/png'
          }
        });
        const images = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
        return { images, thoughts: [] };
      }

      const config: any = {
        imageConfig: {
          aspectRatio: options.aspectRatio || "1:1",
          imageSize: options.imageSize || "1K"
        },
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel || 'Minimal',
          includeThoughts: options.includeThoughts || false
        },
        safetySettings
      };

      if (options.useSearch) {
        config.tools = [{
          googleSearch: options.useImageSearch ? {
            searchTypes: {
              webSearch: {},
              imageSearch: {}
            }
          } : {}
        }];
      }

      const parts: any[] = [];
      
      // If editing, base image comes first
      if (options.baseImage) {
        const match = options.baseImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }

      // Prompt
      parts.push({ 
        text: count > 1 ? `${finalPrompt} (variation ${index + 1})` : finalPrompt 
      });
      
      // Reference images
      if (options.referenceImages && options.referenceImages.length > 0) {
        options.referenceImages.forEach(base64 => {
          const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        });
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config
      });

      const resultImages: string[] = [];
      const resultThoughts: string[] = [];

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const img = `data:image/png;base64,${part.inlineData.data}`;
          if (part.thought) {
            resultThoughts.push(img);
          } else {
            resultImages.push(img);
          }
        }
      }
      
      return { images: resultImages, thoughts: resultThoughts };
    } catch (error) {
      console.error(`Generation error (image ${index}):`, error);
      return { images: [], thoughts: [] };
    }
  };

  const results = await Promise.all(
    Array.from({ length: count }).map((_, i) => generateSingle(i))
  );

  const allImages = results.flatMap(r => r.images);
  const allThoughts = options.includeThoughts ? results.flatMap(r => r.thoughts || []) : [];

  return { images: allImages, thoughts: allThoughts };
}

export async function rewritePromptAsJson(prompt: string): Promise<string> {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY) as string;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: "Rewrite the following image generation prompt into a structured JSON format that describes the scene, subject, style, and technical details. Return ONLY the JSON string.\n\nPrompt: " + prompt,
      config: { safetySettings }
    });
    return response.text || prompt;
  } catch (error) {
    console.error("Prompt rewrite error:", error);
    return prompt;
  }
}

export async function suggestAdvancedField(
  targetField: string,
  currentPrompt: string,
  otherFields: { [key: string]: string }
): Promise<string> {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY) as string;
  const ai = new GoogleGenAI({ apiKey });
  const context = Object.entries(otherFields)
    .filter(([key, val]) => key !== targetField && val.trim() !== '')
    .map(([key, val]) => `${key}: ${val}`)
    .join(', ');

  const prompt = `You are an expert image generation prompt engineer. 
Based on the main prompt: "${currentPrompt}" 
And the current technical settings: ${context || 'None'}
Suggest a highly creative and effective value for the "${targetField}" field to enhance the final image quality.
Return ONLY the suggested value (a few words), no extra text, no quotes.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: { safetySettings }
    });
    return response.text?.trim() || '';
  } catch (error) {
    console.error(`Error suggesting ${targetField}:`, error);
    return '';
  }
}
