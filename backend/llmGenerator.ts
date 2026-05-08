
import OpenAI from 'openai';

interface GenerationResult {
  answer: string;
  confidence: number;
  reasoningPath: string;
  sources: string[];
}

/**
 * TASK 6: LLM Generation
 * Uses OpenAI (ChatGPT) to generate grounded responses.
 */
export class LlmGenerator {
  private client: OpenAI | null = null;

  private getClient() {
    if (!this.client && process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async generate(query: string, contextChunks: any[]): Promise<GenerationResult> {
    const client = this.getClient();
    const contextText = contextChunks
      .map((c, i) => `[${i+1}] (Source: ${c.source}): ${c.text}`)
      .join('\n\n');

    if (!client) {
      return {
        answer: "OpenAI API Key not configured. Using Mock fallback.",
        confidence: 0.5,
        reasoningPath: "Mock execution - skipping LLM generation.",
        sources: [...new Set(contextChunks.map(c => c.source))]
      };
    }

    const systemPrompt = `You are AGX-RAG, an advanced Graph-Augmented Retrieval system.
    Answer the user query strictly using the provided context blocks. 
    Each block is numbered. If you use information from a block, cite it as [n].
    
    Structure your response carefully.
    Include a 'Reasoning Path' at the end of the response describing your logic.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CONTEXT:\n${contextText}\n\nQUERY: ${query}` }
      ],
      temperature: 0.1
    });

    const fullResponse = response.choices[0].message?.content || "";
    
    // Extract Reasoning Path (assuming LLM followed instructions)
    const reasoningMatch = fullResponse.match(/Reasoning Path:?\s*([\s\S]+)$/i);
    const reasoningPath = reasoningMatch ? reasoningMatch[1].trim() : "Direct inference from evidence nodes.";
    const cleanAnswer = fullResponse.replace(/Reasoning Path:?[\s\S]+$/i, "").trim();

    // Compute Confidence (Token overlap ratio between answer and context)
    const confidence = this.computeTokenOverlap(cleanAnswer, contextText);

    return {
      answer: cleanAnswer,
      confidence,
      reasoningPath,
      sources: [...new Set(contextChunks.map(c => c.source))]
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
