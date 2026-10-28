import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockPageScroll } from '../scroll-lock';

let pointerOpener: HTMLElement | null = null;
let openerClickAt = 0;

// Safari does not focus buttons on a pointer click, so activeElement alone can be BODY.
if (typeof document !== 'undefined') document.addEventListener('click', (event) => {
  if (event.target instanceof Element) pointerOpener = event.target.closest<HTMLElement>('button, a[href], input, select, textarea');
  openerClickAt = Date.now();
}, { capture: true });

export function DialogLayer({ open = true, onClose, className = '', label, labelledBy, describedBy, portal = true, children }: {
  open?: boolean;
  onClose: () => void;
  className?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  portal?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const active = document.activeElement;
    const clickedOpener = pointerOpener?.isConnected && !dialog.contains(pointerOpener) && Date.now() - openerClickAt < 500 ? pointerOpener : null;
    const previousFocus = clickedOpener ?? (active instanceof HTMLElement && active !== document.body && !dialog.contains(active) ? active : null);
    dialog.showModal();
    const unlock = lockPageScroll();
    return () => {
      dialog.close();
      unlock();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  const content = <dialog ref={dialogRef} className={`dialog-layer ${className}`} aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {children}
  </dialog>;
  return portal ? createPortal(content, document.body) : content;
}
