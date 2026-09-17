import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea:not([disabled])';

export function useFocusTrap(ref, onDismiss, focusables = FOCUSABLE) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = () => Array.from(el.querySelectorAll(focusables));
    const first = nodes()[0];
    if (first) first.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
        return;
      }
      if (e.key === 'Tab') {
        const list = nodes();
        if (list.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = list[0];
        const lastEl = list[list.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [ref, onDismiss, focusables]);
}