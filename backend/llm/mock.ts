import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

// Last-resort provider. Echoes a stub so the pipeline keeps running
// when no real provider is configured (CI, offline demo, missing keys).
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async complete(_req: LLMRequest): Promise<LLMResponse> {
    return {
      text: 'No LLM provider is configured. Returning a mock response.',
      provider: this.name,
      model: 'mock',
    };
  }
}
