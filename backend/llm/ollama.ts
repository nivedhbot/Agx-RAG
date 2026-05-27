import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

// Talks to a local Ollama server. Defaults to http://127.0.0.1:11434.
// Enabled only when OLLAMA_ENABLED=true (so the router doesn't try a
// loopback connection when no Ollama is running).
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly baseURL: string;
  private readonly model: string;

  constructor() {
    this.baseURL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
    this.model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
  }

  isConfigured(): boolean {
    return process.env.OLLAMA_ENABLED === 'true';
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        stream: false,
        options: {
          temperature: req.temperature ?? 0.1,
          ...(req.maxTokens ? { num_predict: req.maxTokens } : {}),
        },
        ...(req.jsonMode ? { format: 'json' } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    return {
      text: data?.message?.content ?? '',
      provider: this.name,
      model: this.model,
    };
  }
}
