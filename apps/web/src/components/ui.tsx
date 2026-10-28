import { useId, type ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react';
import { DialogLayer } from './DialogLayer';

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  className = '',
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <DialogLayer open={open} className="modal-backdrop" onClose={onClose} labelledBy={titleId} describedBy={description ? descriptionId : undefined}>
      <section
        className={`modal-card ${className}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </DialogLayer>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="section-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label = 'Загружаем данные' }: { label?: string }) {
  return (
    <div className="loading-block">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry, retrying = false }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="error-block" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {onRetry && <button type="button" className="secondary-button" disabled={retrying} onClick={onRetry}>{retrying ? 'Повторяем…' : 'Повторить'}</button>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Inbox size={24} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
