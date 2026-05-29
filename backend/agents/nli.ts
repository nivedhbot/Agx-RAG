import { pipeline } from '@huggingface/transformers';
import type { ClaimRelation } from './types.js';

// Lazy-loaded local NLI classifier. Disabled when LOCAL_NLI_ENABLED=false so
// callers can avoid the cold-start cost in tests.
let classifier: any = null;
let initPromise: Promise<any> | null = null;

const MODEL = process.env.NLI_MODEL ?? 'Xenova/nli-deberta-v3-xsmall';

export function isNliEnabled(): boolean {
  return process.env.LOCAL_NLI_ENABLED !== 'false';
}

async function getClassifier() {
  if (classifier) return classifier;
  if (!initPromise) {
    initPromise = (async () => {
      console.log(`Initializing NLI model (${MODEL})...`);
      classifier = await pipeline('zero-shot-classification', MODEL);
      return classifier;
    })();
  }
  return initPromise;
}

// Load and cache the NLI model ahead of the first query so verification
// doesn't pay the cold-start cost. No-op when NLI is disabled.
export async function warmupNli(): Promise<void> {
  if (!isNliEnabled()) return;
  await getClassifier();
}

export interface NliResult {
  relation: ClaimRelation | 'neutral';
  score: number;
}

// Classify the relation from claim A to claim B.
// Falls back to a heuristic if the model fails or NLI is disabled.
export async function classifyRelation(a: string, b: string): Promise<NliResult> {
  if (!isNliEnabled()) return heuristic(a, b);
  try {
    const cls = await getClassifier();
    const labels = [
      `agrees with the statement: ${b}`,
      `contradicts the statement: ${b}`,
      `is unrelated to the statement: ${b}`,
    ];
    const result: any = await cls(a, labels);
    const top: string = Array.isArray(result.labels) ? result.labels[0] : '';
    const score: number = Array.isArray(result.scores) ? result.scores[0] : 0;
    if (top.startsWith('agrees')) return { relation: 'supports', score };
    if (top.startsWith('contradicts')) return { relation: 'contradicts', score };
    return { relation: 'neutral', score };
  } catch (err) {
    console.warn('[nli] falling back to heuristic:', (err as Error)?.message ?? err);
    return heuristic(a, b);
  }
}

// Lexical fallback when the model is unavailable. Coarse but better than nothing.
function heuristic(a: string, b: string): NliResult {
  const tokA = new Set(a.toLowerCase().match(/\w+/g) ?? []);
  const tokB = new Set(b.toLowerCase().match(/\w+/g) ?? []);
  let overlap = 0;
  tokA.forEach(t => {
    if (tokB.has(t)) overlap++;
  });
  const union = tokA.size + tokB.size - overlap;
  const jaccard = union === 0 ? 0 : overlap / union;
  const negationA = /\b(not|no|never|cannot|isn't|aren't|doesn't|don't)\b/i.test(a);
  const negationB = /\b(not|no|never|cannot|isn't|aren't|doesn't|don't)\b/i.test(b);
  const opposingNegation = negationA !== negationB;
  if (jaccard > 0.4 && opposingNegation) return { relation: 'contradicts', score: jaccard };
  if (jaccard > 0.4) return { relation: 'supports', score: jaccard };
  return { relation: 'neutral', score: jaccard };
}
