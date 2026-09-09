// Inline icon set. Zero corner radius, mitred joins, matching the brandmark.
// No icon library: every one ships styles we do not control.

type P = { className?: string };

const base = "shrink-0";

export function IconDashboard({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="currentColor" aria-hidden>
      <path d="M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z" />
    </svg>
  );
}

export function IconIntelligence({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 4h14v9H8l-4 3v-3H3z" strokeLinejoin="miter" />
      <path d="M6.5 8.5h7" />
    </svg>
  );
}

export function IconReports({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 2.5h7l3 3V17.5H5z" strokeLinejoin="miter" />
      <path d="M7.5 9h5M7.5 12h5" />
    </svg>
  );
}

export function IconClients({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path d="M2.5 16.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
      <path d="M13 8.5a2 2 0 1 0 0-4" />
      <path d="M14 12.2c2 .4 3.5 2.1 3.5 4.3" />
    </svg>
  );
}

export function IconCollection({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" strokeLinecap="butt" />
    </svg>
  );
}

export function IconManage({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="2.5" y="3" width="15" height="5" />
      <rect x="2.5" y="12" width="15" height="5" />
      <path d="M5.5 5.5h.01M5.5 14.5h.01" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ className = "" }: P) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

export function IconCheck({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8.5l3.5 3.5L13 5" strokeLinejoin="miter" />
    </svg>
  );
}

export function IconWarn({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} fill="currentColor" aria-hidden>
      <path d="M8 1.5 15 14H1z" />
      <path d="M8 6v4M8 11.6v1.6" stroke="var(--color-status-warn-fill)" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

export function IconCritical({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} fill="currentColor" aria-hidden>
      <path d="M5 1.5h6L15 5.5v5L11 14.5H5L1 10.5v-5z" />
      <path d="M5.5 8h5" stroke="white" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

export function IconDash({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8h8" />
    </svg>
  );
}

export function IconChevronDown({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 6l4 4 4-4" strokeLinejoin="miter" />
    </svg>
  );
}

export function IconArrowRight({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinejoin="miter" />
    </svg>
  );
}

// A clock with the arrow that means "history", for a column whose values are
// relative times and whose exact ones sit behind it.
export function IconHistory({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 8a5.5 5.5 0 1 1 1.9 4.15" strokeLinecap="square" />
      <path d="M2.2 4.6v3h3" strokeLinejoin="miter" />
      <path d="M8 5v3.2l2.2 1.3" strokeLinejoin="miter" />
    </svg>
  );
}

export function IconCopy({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5.5 5.5h8v8h-8z" />
      <path d="M2.5 10.5v-8h8" />
    </svg>
  );
}

export function IconExport({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 10V2M4.5 5.5 8 2l3.5 3.5" strokeLinejoin="miter" />
      <path d="M2.5 10.5v3h11v-3" />
    </svg>
  );
}

export function IconClose({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconPlus({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function IconSend({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className={`${base} ${className}`} fill="currentColor" aria-hidden>
      <path d="M14 8 2 2l4 6-4 6z" />
    </svg>
  );
}

export function IconEgress({ className = "" }: P) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5v11M2.5 8h11" />
      <path d="M4 4.5c2.4 1.6 5.6 1.6 8 0M4 11.5c2.4-1.6 5.6-1.6 8 0" />
    </svg>
  );
}
