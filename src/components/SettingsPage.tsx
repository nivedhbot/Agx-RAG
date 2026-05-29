import React, { useEffect, useState } from 'react';
import {
  Shield,
  Zap,
  Cpu,
  Database,
} from './SwissUI';
import { authFetch } from '../lib/api';

interface AppSettings {
  ragWeights: { alpha: number; beta: number; gamma: number; lambda: number };
  agent: { maxIterations: number; confidenceThreshold: number };
  toggles: { useAgentPipeline: boolean; localNliEnabled: boolean };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(e => setError(e.message));
  }, []);

  const save = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = await res.json();
      setSettings(next);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    if (!confirm('PURGE_ALL_DATA — this cannot be undone. Continue?')) return;
    setBusy(true);
    try {
      await authFetch('/api/clear', { method: 'POST' });
      setSavedAt(Date.now());
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <div className="animate-in fade-in duration-500 pb-20">
        <p className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
          {error ? `ERROR: ${error}` : 'LOADING_SETTINGS...'}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <section className="mb-12">
        <span className="label-bold text-accent mb-2 block">10. SYSTEM SETTINGS</span>
        <h2 className="headline-lg text-4xl mb-4">Configuration_Manager</h2>
        <p className="text-on-surface-variant max-w-xl label-bold text-xs uppercase tracking-wider">
          Tune the hybrid F(d) weights and the agent reasoning loop. Changes persist to vectorstore/settings.json.
        </p>
        {savedAt && (
          <p className="label-bold text-[10px] text-accent mt-4 uppercase">
            SAVED · {new Date(savedAt).toLocaleTimeString()}
          </p>
        )}
        {error && (
          <p className="label-bold text-[10px] text-red-600 mt-4 uppercase">ERROR: {error}</p>
        )}
      </section>

      <div className="space-y-12">
        {/* Re-ranking weights */}
        <div className="border-t-thick border-foreground pt-8">
          <h3 className="label-bold text-sm mb-2">01. HYBRID_RE-RANKING · F(d) = α·S + β·Gc + γ·Rc − λ·Cp</h3>
          <p className="label-bold text-[10px] opacity-60 mb-8">
            ADJUST WEIGHTS FOR SEMANTIC, GRAPH-CONNECTIVITY, RELATIONAL-BRIDGING, AND CONTRADICTION-PENALTY.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <WeightSlider
              icon={Zap}
              label="α · SEMANTIC"
              value={settings.ragWeights.alpha}
              onChange={v => save({ ragWeights: { ...settings.ragWeights, alpha: v } })}
              disabled={busy}
            />
            <WeightSlider
              icon={Database}
              label="β · GRAPH"
              value={settings.ragWeights.beta}
              onChange={v => save({ ragWeights: { ...settings.ragWeights, beta: v } })}
              disabled={busy}
            />
            <WeightSlider
              icon={Cpu}
              label="γ · RELATIONAL"
              value={settings.ragWeights.gamma}
              onChange={v => save({ ragWeights: { ...settings.ragWeights, gamma: v } })}
              disabled={busy}
            />
            <WeightSlider
              icon={Shield}
              label="λ · CONTRADICTION"
              value={settings.ragWeights.lambda}
              onChange={v => save({ ragWeights: { ...settings.ragWeights, lambda: v } })}
              disabled={busy}
            />
          </div>
        </div>

        {/* Agent loop */}
        <div className="border-t-thick border-foreground pt-8">
          <h3 className="label-bold text-sm mb-8">02. AGENT_REASONING_LOOP</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <NumberField
              label="MAX_ITERATIONS"
              desc="UPPER BOUND ON RETRIEVE → VERIFY → REFINE CYCLES."
              value={settings.agent.maxIterations}
              min={1}
              max={5}
              step={1}
              onChange={v => save({ agent: { ...settings.agent, maxIterations: v } })}
              disabled={busy}
            />
            <NumberField
              label="CONFIDENCE_THRESHOLD"
              desc="MIN SYNTHESIS CONFIDENCE TO EXIT THE LOOP EARLY."
              value={settings.agent.confidenceThreshold}
              min={0}
              max={1}
              step={0.05}
              onChange={v => save({ agent: { ...settings.agent, confidenceThreshold: v } })}
              disabled={busy}
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="border-t-thick border-foreground pt-8">
          <h3 className="label-bold text-sm mb-8">03. RUNTIME_TOGGLES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ToggleField
              label="AGENT_PIPELINE"
              desc="USE THE FULL 5-AGENT CGOT-MARS LOOP. OFF = LEGACY SINGLE-PASS."
              value={settings.toggles.useAgentPipeline}
              onChange={v => save({ toggles: { ...settings.toggles, useAgentPipeline: v } })}
              disabled={busy}
            />
            <ToggleField
              label="LOCAL_NLI"
              desc="DEBERTA-V3-XSMALL FOR CLAIM RELATIONS. OFF = LEXICAL HEURISTIC."
              value={settings.toggles.localNliEnabled}
              onChange={v => save({ toggles: { ...settings.toggles, localNliEnabled: v } })}
              disabled={busy}
            />
          </div>
        </div>

        <div className="bg-foreground text-background p-8 md:p-12 border-l-thick border-accent mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <h3 className="headline-lg text-white mb-2">Danger_Zone</h3>
              <p className="label-bold opacity-60 text-xs">REMOVING THE ENTIRE CORPUS IS IRREVERSIBLE.</p>
            </div>
            <button
              onClick={purge}
              disabled={busy}
              className="px-8 py-3 bg-accent text-white label-bold hover:bg-white hover:text-accent transition-all disabled:opacity-40"
            >
              PURGE_ALL_DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightSlider({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
}: {
  icon: any;
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-surface swiss-border border-thin p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-foreground text-background flex items-center justify-center">
          <Icon size={18} />
        </div>
        <span className="label-bold text-[10px] opacity-60">{label}</span>
      </div>
      <div className="text-3xl font-[900] text-accent tracking-tighter mb-3">{value.toFixed(2)}</div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function NumberField({
  label,
  desc,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-surface swiss-border border-thin p-6">
      <div className="flex justify-between items-start mb-3">
        <span className="label-bold text-[10px] opacity-60">{label}</span>
        <span className="label-bold text-[10px] text-accent">{value}</span>
      </div>
      <p className="text-xs font-medium leading-relaxed uppercase opacity-80 mb-4">{desc}</p>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border-thick border-foreground bg-background p-3 label-bold text-sm"
      />
    </div>
  );
}

function ToggleField({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-surface swiss-border border-thin p-6">
      <div className="flex justify-between items-start mb-3">
        <span className="label-bold text-[10px] opacity-60">{label}</span>
        <button
          onClick={() => onChange(!value)}
          disabled={disabled}
          className={`px-3 py-1 label-bold text-[10px] ${value ? 'bg-accent text-white' : 'bg-foreground text-background'} disabled:opacity-40`}
        >
          {value ? 'ON' : 'OFF'}
        </button>
      </div>
      <p className="text-xs font-medium leading-relaxed uppercase opacity-80">{desc}</p>
    </div>
  );
}
