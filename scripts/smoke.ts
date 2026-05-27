// Phase 1 + 2 smoke test. Run with: npx tsx scripts/smoke.ts

process.env.OPENAI_API_KEY = '';
process.env.NVIDIA_API_KEY = '';
process.env.OLLAMA_ENABLED = 'false';
process.env.LOCAL_NLI_ENABLED = 'false'; // skip model download in smoke

import { llmRouter } from '../backend/llm/router.js';
import { processPdf } from '../backend/documentProcessor.js';
import { orchestratorAgent } from '../backend/agents/orchestrator.js';
import { vectorStore } from '../backend/vectorStore.js';
import { graphBuilder } from '../backend/graphBuilder.js';
import fs from 'fs/promises';
import path from 'path';

function ok(label: string, cond: boolean, extra?: string) {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('--- Phase 1: LLM Router ---');
  ok('high → mock when nothing configured', llmRouter.pick('high').name === 'mock');
  ok('low → mock when nothing configured', llmRouter.pick('low').name === 'mock');

  process.env.OPENAI_API_KEY = 'sk-fake';
  ok('high → openai when key present', llmRouter.pick('high').name === 'openai');
  ok('low → openai when only openai configured', llmRouter.pick('low').name === 'openai');

  process.env.NVIDIA_API_KEY = 'nvidia-fake';
  ok('high → openai when both configured', llmRouter.pick('high').name === 'openai');
  ok('low → nvidia preferred when both configured', llmRouter.pick('low').name === 'nvidia');

  // Restore: no real keys for the rest of the test so the mock provider returns stubs.
  process.env.OPENAI_API_KEY = '';
  process.env.NVIDIA_API_KEY = '';

  console.log('\n--- Phase 1: Page-aware chunking ---');
  // Build a tiny fake "two page" PDF result via the parser's outputs:
  // We can't easily synthesize a real PDF, so we drive processPdf with a buffer
  // that has the smallest valid PDF (a 1-page blank). At minimum, processPdf must
  // not crash and must yield a page number >= 1 for every chunk.
  try {
    const sample = await tryRealPdf();
    if (sample) {
      const chunks = await processPdf(sample, 'sample.pdf');
      ok('chunks produced from real PDF', chunks.length > 0, `${chunks.length} chunks`);
      ok('every chunk has a numeric page', chunks.every(c => Number.isFinite(c.page) && c.page >= 1));
      const pages = new Set(chunks.map(c => c.page));
      console.log(`     distinct pages seen: ${[...pages].sort((a, b) => a - b).join(', ')}`);
    } else {
      console.log('[SKIP] no sample PDF available — placing one at scripts/sample.pdf will exercise chunking');
    }
  } catch (e) {
    ok('processPdf did not throw', false, (e as Error).message);
  }

  console.log('\n--- Phase 2: Orchestrator end-to-end (mock LLM) ---');
  await vectorStore.load();
  await graphBuilder.load();
  const corpus = vectorStore.getAllChunks();
  console.log(`     corpus chunks loaded: ${corpus.length}`);
  if (corpus.length === 0) {
    console.log('[SKIP] no corpus loaded — upload a PDF via the app, then re-run');
    return;
  }

  const result = await orchestratorAgent.run('What is the main subject of this corpus?');
  ok('orchestrator returned a result', Boolean(result));
  ok('result has agentTrace entries', Array.isArray(result.agentTrace) && result.agentTrace.length > 0, `${result.agentTrace.length} steps`);
  ok('claimGraph has a query node', Boolean(result.claimGraph?.queryNodeId));
  ok('evidenceChain returned (may be empty)', Array.isArray(result.evidenceChain));
  console.log('     latency:', result.latencyMs + 'ms');
  console.log('     confidence:', result.confidence);
  console.log('     trace agents:', result.agentTrace.map(t => `${t.agent}.${t.action}`).join(' → '));
  console.log('     answer (first 160 chars):', result.answer.slice(0, 160));
}

async function tryRealPdf(): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'sample.pdf'),
    path.join(process.cwd(), 'sample.pdf'),
  ];
  for (const p of candidates) {
    try {
      return await fs.readFile(p);
    } catch {
      // ignore
    }
  }
  return null;
}

main().catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
