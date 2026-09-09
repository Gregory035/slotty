export function SlottyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M6 5v18M21.5 5v18" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
      <path d="M9.5 9.5h9v9h-9z" fill="currentColor" />
      <path d="M12.5 12.5h3v3h-3z" fill="var(--mark-cutout)" />
    </svg>
  );
}

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''} ${inverse ? 'brand-lockup-inverse' : ''}`} aria-label="Slotty">
      <span className="brand-mark"><SlottyMark size={compact ? 20 : 23} /></span>
      {!compact && <span className="brand-wordmark">Slotty</span>}
    </div>
  );
}
