import OpenAI from 'openai';
import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

// NVIDIA NIM exposes an OpenAI-compatible endpoint.
// Set NVIDIA_API_KEY and optionally NVIDIA_MODEL / NVIDIA_BASE_URL.
export class NvidiaProvider implements LLMProvider {
  readonly name = 'nvidia';
  private client: OpenAI | null = null;
  private readonly model: string;
  private readonly baseURL: string;

  constructor(model?: string, baseURL?: string) {
    this.model = model ?? process.env.NVIDIA_MODEL ?? 'meta/llama-3.1-8b-instruct';
    this.baseURL = baseURL ?? process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
  }

  isConfigured(): boolean {
    return Boolean(process.env.NVIDIA_API_KEY);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: this.baseURL,
      });
    }
    return this.client;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.1,
      max_tokens: req.maxTokens,
    });

    return {
      text: response.choices[0]?.message?.content ?? '',
      provider: this.name,
      model: this.model,
    };
  }
}
