import type { CallPriority, LLMProvider, LLMRequest, LLMResponse } from './types.js';
import { OpenAIProvider } from './openai.js';
import { NvidiaProvider } from './nvidia.js';
import { OllamaProvider } from './ollama.js';
import { MockProvider } from './mock.js';

// Priority-based router:
//   'high' (final synthesis): OpenAI → NVIDIA NIM → Ollama → mock
//   'low'  (cheap agent ops): NVIDIA NIM → Ollama → OpenAI → mock
// Fallback inside a priority is "first configured wins". If a configured
// provider throws at call time, we walk the chain.
export class LLMRouter {
  private readonly openai = new OpenAIProvider();
  private readonly nvidia = new NvidiaProvider();
  private readonly ollama = new OllamaProvider();
  private readonly mock = new MockProvider();

  private chain(priority: CallPriority): LLMProvider[] {
    if (priority === 'high') {
      return [this.openai, this.nvidia, this.ollama, this.mock];
    }
    return [this.nvidia, this.ollama, this.openai, this.mock];
  }

  pick(priority: CallPriority): LLMProvider {
    return this.chain(priority).find(p => p.isConfigured()) ?? this.mock;
  }

  async complete(priority: CallPriority, req: LLMRequest): Promise<LLMResponse> {
    const chain = this.chain(priority).filter(p => p.isConfigured());
    let lastErr: unknown = null;
    for (const provider of chain) {
      try {
        return await provider.complete(req);
      } catch (err) {
        lastErr = err;
        console.warn(`[llm] ${provider.name} failed, trying next:`, (err as Error)?.message ?? err);
      }
    }
    if (lastErr) throw lastErr;
    return this.mock.complete(req);
  }
}

export const llmRouter = new LLMRouter();
