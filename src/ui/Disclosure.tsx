import { useId, useState, type ReactNode } from "react";

interface Props {
  /** Visible label on the toggle, e.g. "More" or "Other surfaces". */
  label: string;
  /** Quiet right-hand hint, e.g. the products currently chosen. */
  hint?: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A plain button + conditional render, deliberately NOT <details>/<summary>.
 *
 * Two reasons. First, jsdom does not implement <details>' native hiding, so
 * a closed <summary>'s contents stay queryable in tests — a test asserting
 * "this is behind a disclosure" would pass whether or not the disclosure
 * actually worked. Unmounting the body makes the closed state real in both
 * the browser and the test environment. Second, <summary>'s ARIA mapping is
 * inconsistent across engines, whereas a button with aria-expanded is
 * unambiguous to a screen reader and to `getByRole("button", ...)`.
 */
export function Disclosure({
  label,
  hint,
  className,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className={`disclosure${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="disclosure-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="disclosure-label">{label}</span>
        {hint && <span className="disclosure-hint">{hint}</span>}
        <span aria-hidden="true" className="disclosure-chevron" />
      </button>
      {open && (
        <div id={bodyId} className="disclosure-body">
          {children}
        </div>
      )}
    </div>
  );
}
