import React, { useEffect, useRef, useState, useId } from "react";
import { Icon } from "./Icon";
export function CounterBadge({ count }: { count: number }) {
  return <span className="counter">{count}</span>;
}

export function ToolButton({
  label,
  icon,
  onClick,
  pressed,
  disabled,
  className = "",
  children,
  ...rest
}: any) {
  return (
    <button
      type="button"
      className={`icon-button tooltip-host ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      <Icon name={icon} />
      {children}
      <span className="tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLInputElement>(
        "input:not([type=checkbox]),textarea,select",
      )
      ?.focus();
    return () => {
      before?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <ToolButton icon="close" label="Close dialog" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
export interface MenuAction {
  label: string;
  icon?: string;
  description?: string;
  key?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  checked?: boolean;
  role?: "menuitem" | "menuitemradio" | "menuitemcheckbox";
}
export function Menu({
  items,
  onClose,
  align = "end",
}: {
  items: MenuAction[];
  onClose: () => void;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const listener = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(
      () => document.addEventListener("pointerdown", listener),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", listener);
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div
      className={`menu menu-${align}`}
      ref={ref}
      role="menu"
      onKeyDown={(e) => {
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        let index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          index =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length;
          buttons[index]?.focus();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        const item = items.find(
          (i) => i.key?.toLowerCase() === e.key.toLowerCase(),
        );
        if (item && !item.disabled) {
          e.preventDefault();
          onClose();
          item.onClick();
        }
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={`${item.label}-${i}`}>
          {item.separator && (
            <div className="menu-separator" role="separator" />
          )}
          <button
            type="button"
            role={item.role || "menuitem"}
            aria-checked={
              item.role && item.role !== "menuitem" ? !!item.checked : undefined
            }
            disabled={item.disabled}
            className={`menu-item ${item.danger ? "danger-text" : ""}`}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            <Icon name={item.icon || (item.checked ? "check" : "blank")} />
            <span>
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </span>
            {item.key && <kbd>{item.key}</kbd>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
export function TextDialog({
  title,
  label,
  initial = "",
  onClose,
  onSubmit,
  submitLabel = "Save",
  description,
}: {
  title: string;
  label: string;
  initial?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
  submitLabel?: string;
  description?: string;
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(value.trim());
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {description && <p>{description}</p>}
        <label className="field">
          {label}
          <input
            autoFocus
            required
            maxLength={120}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={busy || !value.trim()}
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NavigationProgress({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 100);
    return () => window.clearTimeout(timer);
  }, [pending]);
  return <div className={`navigation-progress ${visible ? "is-pending" : ""}`} aria-hidden="true"><span /></div>;
}
