import { AlertTriangle, ArrowRight, CheckCircle2, Command, Search, ShieldCheck } from 'lucide-react';
import type { RackConfig, SimulationResult } from '../types';

export function WorkspaceHealthRibbon({
  rack,
  result,
  onReview,
  onCommand,
}: {
  rack: RackConfig;
  result: SimulationResult;
  onReview: () => void;
  onCommand: () => void;
}) {
  const critical = result.severity === 'critical';
  const warning = result.severity === 'warning';
  const tone = critical ? 'text-danger' : warning ? 'text-warning' : 'text-success';
  const bg = critical ? 'bg-danger/[0.06]' : warning ? 'bg-warning/[0.05]' : 'bg-success/[0.04]';
  const border = critical ? 'border-danger/20' : warning ? 'border-warning/20' : 'border-success/15';
  const headline = result.warnings.length === 0
    ? 'All modeled systems nominal'
    : `${result.warnings.length} ${result.warnings.length === 1 ? 'advisory' : 'advisories'} require review`;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={`flex h-10 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md sm:px-5 ${border} ${bg}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${border} ${bg} ${tone}`}>
          {critical || warning ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
        </span>
        <span className={`truncate text-[10px] font-semibold ${tone}`}>{headline}</span>
        <span className="hidden h-3 w-px bg-line md:block" />
        <span className="hidden truncate text-[10px] text-muted md:block">{rack.name}</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted lg:flex">
          <CheckCircle2 size={10} className="text-success" /> Live calculations
        </span>
        <button onClick={onReview} className={`hidden h-7 items-center gap-1.5 rounded-md border px-2.5 text-[9px] font-semibold transition sm:flex ${border} ${bg} ${tone} hover:bg-white/5`}>
          {warning || critical ? 'Review issues' : 'View telemetry'} <ArrowRight size={11} />
        </button>
        <button onClick={onCommand} className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-ink/70 px-2 text-[9px] text-muted transition hover:border-accent/30 hover:text-accent" aria-label="Open command palette">
          <Search size={11} />
          <span className="hidden sm:inline">Quick actions</span>
          <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-line bg-panel2 px-1 py-0.5 font-mono text-[8px] text-muted md:flex"><Command size={8} />K</kbd>
        </button>
      </div>
    </div>
  );
}
