import { Sparkles } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`} aria-label="Slotty">
      <span className="brand-mark"><Sparkles size={18} strokeWidth={2} /></span>
      {!compact && <span className="brand-wordmark">Slotty</span>}
    </div>
  );
}
