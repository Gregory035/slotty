import type { CSSProperties } from 'react';

type LogoTone = 'auto' | 'light' | 'dark';

function LogoAsset({ icon, tone = 'auto', size }: { icon: boolean; tone?: LogoTone; size?: number }) {
  const base = icon ? '/brand/slotty-icon' : '/brand/slotty-logo-horizontal';
  const style = size ? { '--slotty-logo-size': `${size}px` } as CSSProperties : undefined;

  return (
    <span className={`slotty-logo-asset ${icon ? 'slotty-logo-asset-icon' : 'slotty-logo-asset-horizontal'} slotty-logo-asset-${tone}`} style={style} aria-hidden="true">
      <img className="slotty-logo-light" src={`${base}-light.svg`} alt="" />
      <img className="slotty-logo-dark" src={`${base}-dark.svg`} alt="" />
    </span>
  );
}

export function SlottyMark({ size = 28, tone = 'auto' }: { size?: number; tone?: LogoTone }) {
  return <LogoAsset icon tone={tone} size={size} />;
}

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`} aria-label="Slotty" role="img">
      <LogoAsset icon={compact} tone={inverse ? 'dark' : 'auto'} />
    </div>
  );
}
