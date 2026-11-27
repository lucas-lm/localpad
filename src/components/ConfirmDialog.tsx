import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Promise-based replacement for window.confirm.
 * Render the returned element anywhere in the component; `await confirm({...})` resolves to true or false.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({ title, message, confirmLabel = 'Delete', onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal(); // modal: traps focus, Esc cancels, page behind is inert
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      // The dialog element itself has no padding, so a click whose target is the dialog landed on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div className="dialog-body">
        <h2 id={`${id}-title`} className="dialog-title">
          {title}
        </h2>
        <p id={`${id}-message`} className="dialog-message">
          {message}
        </p>
        <div className="dialog-actions">
          {/* Cancel comes first so it receives initial focus: Enter never deletes by accident. */}
          <button className="btn" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
