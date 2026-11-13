import { useToast, type ToastType } from '../../state/toastStore';
import { CheckIcon } from '../icons/CheckIcon';
import { AlertCircleIcon } from '../icons/AlertCircleIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { LoaderIcon } from '../icons/LoaderIcon';

const ICONS: Record<ToastType, React.FC> = {
  default: InfoIcon,
  success: CheckIcon,
  error: AlertCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  loading: LoaderIcon,
};

const COLORS: Record<string, string> = {
  success: 'var(--success, #22c55e)',
  error: 'var(--danger, #ef4444)',
  warning: 'var(--warning, #f59e0b)',
  info: 'var(--info, #3b82f6)',
  loading: 'var(--accent, #6366f1)',
  default: 'var(--text)',
};

/** The small transient message at the bottom of the screen. */
export function Toast() {
  const toasts = useToast(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" id="toast" role="status" aria-live="polite">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className={`toast ${t.type}`} style={{ borderLeftColor: COLORS[t.type] }}>
            <Icon />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}