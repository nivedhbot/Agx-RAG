import OpenAI from 'openai';
import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;
  private readonly model: string;

  constructor(model: string = 'gpt-4o') {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
      ...(req.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });

    return {
      text: response.choices[0]?.message?.content ?? '',
      provider: this.name,
      model: this.model,
    };
  }
}
