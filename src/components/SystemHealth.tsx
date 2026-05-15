import React from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  Zap, 
  Network,
  Shield,
  Terminal
} from './SwissUI';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

export default function SystemHealth() {
  const [performanceData] = React.useState(() => 
    Array.from({ length: 20 }, (_, i) => ({
      time: `${i}:00`,
      cpu: 40 + Math.random() * 40,
      memory: 30 + Math.random() * 20,
      latency: 100 + Math.random() * 500,
    }))
  );

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <section className="mb-12">
        <span className="label-bold text-accent mb-2 block">11. TELEMETRY DATA</span>
        <h2 className="headline-lg text-4xl mb-4">Diagnostics_Panel</h2>
        <p className="text-on-surface-variant max-w-xl label-bold text-xs uppercase tracking-wider">
          Real-time monitoring of graph traversal speeds, embedding latency, and system resource distribution.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { icon: Activity, label: 'UPTIME', val: '99.98%', trend: '+0.01%' },
          { icon: Zap, label: 'AVG_LATENCY', val: '342MS', trend: '-12MS' },
          { icon: Database, label: 'STORAGE_LOAD', val: '4.2GB', trend: 'STABLE' },
          { icon: Network, label: 'GRAPH_NODES', val: '1.4M', trend: '+2K/HR' },
        ].map((stat, i) => (
          <div key={i} className="border-thick border-foreground p-6 bg-surface group hover:bg-foreground hover:text-background transition-colors cursor-crosshair">
            <div className="flex justify-between items-start mb-6">
              <stat.icon className="text-accent group-hover:text-white" size={24} />
              <span className="label-bold text-[10px] text-accent group-hover:text-white">{stat.trend}</span>
            </div>
            <p className="label-bold text-[10px] mb-1 opacity-60">{stat.label}</p>
            <p className="text-3xl font-[900] tracking-tighter">{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="border-thick border-foreground p-8 bg-surface overflow-hidden">
          <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 flex justify-between">
            <span>CPU_VS_MEMORY_EFFICIENCY_</span>
            <span className="text-accent">LIVE_FEED</span>
          </h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="time" hide />
                <YAxis fontSize={10} tick={{ fill: '#000' }} />
                <Tooltip />
                <Area type="monotone" dataKey="cpu" stroke="#FF4D00" fill="#FF4D00" fillOpacity={0.1} />
                <Area type="monotone" dataKey="memory" stroke="#000000" fill="#000000" fillOpacity={0.05} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-thick border-foreground p-8 bg-surface">
          <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 flex justify-between">
            <span>INTERFERENCE_LOGS_</span>
            <span className="text-accent">LEVEL_4</span>
          </h3>
          <div className="space-y-4 font-mono text-[10px] uppercase">
            {[
              '2024-03-21 12:44:01 - NODE_RESOLVER - SUCCESS - 0.2MS',
              '2024-03-21 12:44:05 - EMBEDDING_CACHE - HIT - 0.05MS',
              '2024-03-21 12:44:09 - RE-RANKER_F(D) - EXECUTED - 142MS',
              '2024-03-21 12:44:12 - GRAPH_PERSIST - SERIALIZED - 850KB',
              '2024-03-21 12:44:15 - UI_POLLING - STABLE',
              '2024-03-21 12:44:18 - SECURITY_GUARD - NO_THREAT_DETECTED',
            ].map((log, i) => (
              <div key={i} className="flex gap-4 border-b border-foreground/5 pb-2">
                <span className="opacity-40">{i+1024}</span>
                <span className="flex-1">{log}</span>
                <span className="text-green-600">OK_</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
