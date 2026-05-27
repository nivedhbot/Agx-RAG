import fs from 'fs-extra';
import path from 'path';

export interface AppSettings {
  ragWeights: { alpha: number; beta: number; gamma: number; lambda: number };
  agent: { maxIterations: number; confidenceThreshold: number };
  toggles: { useAgentPipeline: boolean; localNliEnabled: boolean };
}

const DEFAULTS: AppSettings = {
  ragWeights: { alpha: 0.6, beta: 0.2, gamma: 0.15, lambda: 0.05 },
  agent: { maxIterations: 2, confidenceThreshold: 0.55 },
  toggles: { useAgentPipeline: true, localNliEnabled: true },
};

class SettingsStore {
  private settings: AppSettings = clone(DEFAULTS);
  private readonly file = path.join(process.cwd(), 'vectorstore', 'settings.json');
  private loaded = false;

  async load() {
    if (this.loaded) return;
    if (await fs.pathExists(this.file)) {
      try {
        const data = await fs.readJson(this.file);
        this.settings = validate(merge(clone(DEFAULTS), data));
      } catch (err) {
        console.warn('[settings] failed to read, using defaults:', (err as Error).message);
      }
    }
    this.loaded = true;
    this.applyEnvSideEffects();
  }

  get(): AppSettings {
    return this.settings;
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const merged = merge(this.settings, patch);
    this.settings = validate(merged);
    await fs.ensureDir(path.dirname(this.file));
    await fs.writeJson(this.file, this.settings, { spaces: 2 });
    this.applyEnvSideEffects();
    return this.settings;
  }

  // Mirror a subset of settings into process.env so modules that read env at
  // call time (NLI, agent pipeline) pick up changes without a restart.
  private applyEnvSideEffects() {
    process.env.USE_AGENT_PIPELINE = String(this.settings.toggles.useAgentPipeline);
    process.env.LOCAL_NLI_ENABLED = String(this.settings.toggles.localNliEnabled);
    process.env.AGENT_MAX_ITERATIONS = String(this.settings.agent.maxIterations);
    process.env.AGENT_CONFIDENCE_THRESHOLD = String(this.settings.agent.confidenceThreshold);
  }
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// Coerce + clamp fields so corrupt settings can never poison downstream math.
function validate(s: AppSettings): AppSettings {
  const num01 = (v: any, fallback: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(1, Math.max(0, n));
  };
  const numInt = (v: any, min: number, max: number, fallback: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const bool = (v: any, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    ragWeights: {
      alpha: num01(s.ragWeights?.alpha, DEFAULTS.ragWeights.alpha),
      beta: num01(s.ragWeights?.beta, DEFAULTS.ragWeights.beta),
      gamma: num01(s.ragWeights?.gamma, DEFAULTS.ragWeights.gamma),
      lambda: num01(s.ragWeights?.lambda, DEFAULTS.ragWeights.lambda),
    },
    agent: {
      maxIterations: numInt(s.agent?.maxIterations, 1, 5, DEFAULTS.agent.maxIterations),
      confidenceThreshold: num01(s.agent?.confidenceThreshold, DEFAULTS.agent.confidenceThreshold),
    },
    toggles: {
      useAgentPipeline: bool(s.toggles?.useAgentPipeline, DEFAULTS.toggles.useAgentPipeline),
      localNliEnabled: bool(s.toggles?.localNliEnabled, DEFAULTS.toggles.localNliEnabled),
    },
  };
}

function merge<T extends Record<string, any>>(base: T, patch: any): T {
  if (!patch || typeof patch !== 'object') return base;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
      out[k] = merge(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export const settings = new SettingsStore();
