export type CallPriority = 'high' | 'low';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(req: LLMRequest): Promise<LLMResponse>;
}
