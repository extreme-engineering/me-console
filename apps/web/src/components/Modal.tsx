import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const MAX_WIDTHS: Record<string, string> = {
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save and restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus first focusable element inside modal, or the modal itself
      requestAnimationFrame(() => {
        const first = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        if (first) {
          first.focus();
        } else {
          modalRef.current?.focus();
        }
      });
    } else {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 200ms var(--ease-out)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(26, 25, 24, 0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative bg-[var(--color-surface)] w-full rounded-xl overflow-hidden outline-none"
        style={{
          maxWidth: MAX_WIDTHS[maxWidth.replace('max-w-', '')] ?? maxWidth,
          boxShadow: 'var(--shadow-xl)',
          animation: 'scaleIn 250ms var(--ease-out)',
        }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border-light)' }}
        >
          <h2
            className="text-base font-medium"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-ink)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-ink-3)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-paper-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
