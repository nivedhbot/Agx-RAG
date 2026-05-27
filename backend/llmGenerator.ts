import { llmRouter } from './llm/router.js';

interface GenerationResult {
  answer: string;
  confidence: number;
  reasoningPath: string;
  sources: string[];
}

export class LlmGenerator {
  async generate(query: string, contextChunks: any[]): Promise<GenerationResult> {
    const contextText = contextChunks
      .map((c, i) => `[${i + 1}] (Source: ${c.source}): ${c.text}`)
      .join('\n\n');

    const systemPrompt = `You are AGX-RAG, an advanced Graph-Augmented Retrieval system.
    Answer the user query strictly using the provided context blocks.
    Each block is numbered. If you use information from a block, cite it as [n].

    Structure your response carefully.
    Include a 'Reasoning Path' at the end of the response describing your logic.`;

    const response = await llmRouter.complete('high', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CONTEXT:\n${contextText}\n\nQUERY: ${query}` },
      ],
      temperature: 0.1,
    });

    const fullResponse = response.text;

    const reasoningMatch = fullResponse.match(/Reasoning Path:?\s*([\s\S]+)$/i);
    const reasoningPath = reasoningMatch
      ? reasoningMatch[1].trim()
      : 'Direct inference from evidence nodes.';
    const cleanAnswer = fullResponse.replace(/Reasoning Path:?[\s\S]+$/i, '').trim();

    const confidence = this.computeTokenOverlap(cleanAnswer, contextText);

    return {
      answer: cleanAnswer,
      confidence,
      reasoningPath,
      sources: [...new Set(contextChunks.map(c => c.source))],
    };
  }

  private computeTokenOverlap(answer: string, context: string): number {
    const tokenize = (text: string) => new Set(text.toLowerCase().match(/\w+/g) || []);
    const answerTokens = tokenize(answer);
    const contextTokens = tokenize(context);

    if (answerTokens.size === 0) return 0;

    let overlap = 0;
    answerTokens.forEach(token => {
      if (contextTokens.has(token)) overlap++;
    });

    return overlap / answerTokens.size;
  }
}

export const llmGenerator = new LlmGenerator();
