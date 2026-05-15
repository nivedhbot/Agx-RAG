import React from 'react';
import { 
  Settings, 
  Shield, 
  Zap, 
  Network, 
  Cpu, 
  Database,
  Lock,
  Eye,
  Key
} from './SwissUI';

export default function SettingsPage() {
  const zapIcon = Zap;
  const settingsGroups = [
    {
      title: '01. SYSTEM_CONFIGURATION',
      items: [
        { icon: Cpu, label: 'COMPUTE_ALLOCATION', val: 'HIGH_PRIORITY', desc: 'Allocation of local resources for embedding generation.' },
        { icon: Database, label: 'VECTOR_STORE_PERSISTENCE', val: 'ENABLED', desc: 'Auto-save frequency for the local vector index.' },
        { icon: zapIcon, label: 'RE-RANKING_STRATEGY', val: 'HYBRID_F(D)', desc: 'Formula balancing semantic and graph connectivity.' },
      ]
    },
    {
      title: '02. SECURITY_&_PRIVACY',
      items: [
        { icon: Shield, label: 'ENCRYPTION_AT_REST', val: 'AES-256', desc: 'All local JSON files are encrypted using standard protocols.' },
        { icon: Lock, label: 'ACCESS_CONTROL', val: 'LOCAL_ONLY', desc: 'Prevents remote access to the document corpus.' },
        { icon: Key, label: 'API_INTEGRATION', val: 'OPENAI_VALID', desc: 'Status of your third-party processing keys.' },
      ]
    }
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <section className="mb-12">
        <span className="label-bold text-accent mb-2 block">10. SYSTEM SETTINGS</span>
        <h2 className="headline-lg text-4xl mb-4">Configuration_Manager</h2>
        <p className="text-on-surface-variant max-w-xl label-bold text-xs uppercase tracking-wider">
          Fine-tune the graph-reasoning engine and manage your local data environment.
        </p>
      </section>

      <div className="space-y-12">
        {settingsGroups.map((group, i) => (
          <div key={i} className="border-t-thick border-foreground pt-8">
            <h3 className="label-bold text-sm mb-8">{group.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {group.items.map((item, j) => (
                <div key={j} className="bg-surface swiss-border border-thin p-6 flex gap-6 hover:border-accent transition-colors group">
                  <div className="shrink-0 w-12 h-12 bg-foreground text-background flex items-center justify-center group-hover:bg-accent transition-colors">
                    <item.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <span className="label-bold text-[10px] opacity-60">{item.label}</span>
                      <span className="label-bold text-[10px] text-accent">{item.val}</span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed uppercase opacity-80">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-foreground text-background p-8 md:p-12 border-l-thick border-accent mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <h3 className="headline-lg text-white mb-2">Danger_Zone</h3>
              <p className="label-bold opacity-60 text-xs">REMOVING THE ENTIRE CORPUS IS IRREVERSIBLE. USE WITH CAUTION.</p>
            </div>
            <button className="px-8 py-3 bg-accent text-white label-bold hover:bg-white hover:text-accent transition-all">
              PURGE_ALL_DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
