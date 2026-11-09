import React from 'react';

// ---------- Icons (inline, stroke-based) ----------
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4',
  mic: 'M17 20a5 5 0 0 0-10 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  x: 'M18 6 6 18M6 6l12 12',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  menu: 'M3 12h18M3 6h18M3 18h18',
  chevron: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  merge: 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21V9a9 9 0 0 0 9 9',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  ext: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
};
export function Icon({ name, size = 16, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

// ---------- Buttons ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'; size?: 'sm' | 'md'; icon?: string };
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', icon, className = '', children, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
});

// ---------- Badges ----------
export type Tone = 'neutral' | 'purple' | 'gold' | 'green' | 'amber' | 'red' | 'blue' | 'outline';
export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}
export const STAGE_TONE: Record<string, Tone> = {
  'Not contacted': 'outline', 'Awaiting reply': 'amber', Replied: 'blue', 'Chat scheduled': 'purple', 'Chat completed': 'green', Closed: 'neutral',
  Considering: 'outline', Applied: 'blue', Assessment: 'blue', 'First round': 'purple', 'Further rounds': 'purple', 'Final round': 'purple', Offer: 'green', Rejected: 'neutral', Withdrawn: 'neutral',
  high: 'red', medium: 'amber', low: 'neutral',
  Requested: 'amber', Accepted: 'blue', Scheduled: 'purple', Completed: 'green', Declined: 'neutral', Cancelled: 'neutral',
  'In progress': 'blue', Overdue: 'red', 'Not started': 'outline', Missed: 'red',
  approved: 'green', pending: 'amber', merged: 'neutral', open: 'green', closed: 'neutral', unknown: 'outline',
};
export const StageBadge = ({ s }: { s: string }) => <Badge tone={STAGE_TONE[s] ?? 'neutral'}>{s[0].toUpperCase() + s.slice(1)}</Badge>;
export const DemoTag = ({ children = 'Demo data' }: { children?: React.ReactNode }) => <span className="demo-tag">{children}</span>;
export const SimTag = ({ children = 'Simulated' }: { children?: React.ReactNode }) => <span className="sim-tag"><Icon name="info" size={12} />{children}</span>;

// ---------- Forms ----------
export function Field({ label, hint, error, children, required, id, className = '' }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; required?: boolean; id?: string; className?: string }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}{required && <span className="req-mark" aria-hidden="true"> *</span>}{!required && <span className="opt"> optional</span>}</label>
      {children}
      {error ? <div className="field-error" role="alert">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}
export function Select<T extends string>({ value, onChange, options, id, placeholder, ariaLabel, className = '', disabled }: { value: T | ''; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; id?: string; placeholder?: string; ariaLabel?: string; className?: string; disabled?: boolean }) {
  return (
    <select id={id} className={`input ${className}`} value={value} aria-label={ariaLabel} disabled={disabled} onChange={e => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Chips<T extends string>({ options, value, onChange, ariaLabel }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; ariaLabel: string }) {
  return (
    <div className="chips" role="group" aria-label={ariaLabel}>
      {options.map(o => {
        const on = value.includes(o);
        return <button type="button" key={o} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}>{on && <Icon name="check" size={12} />}{o}</button>;
      })}
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
  return (
    <div className="search">
      <Icon name="search" size={15} />
      <input id={id} className="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ---------- Overlays ----------
function useEsc(onClose: () => void) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}
function useFocusIn(ref: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button:not(.close-x)');
    (first ?? el)?.focus();
    return () => { prev?.focus?.(); };
  }, []);
}
function trapTab(e: React.KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return;
  const f = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  const [a, z] = [f[0], f[f.length - 1]];
  if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
}
export function Modal({ title, onClose, children, footer, wide, subtitle }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; subtitle?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useEsc(onClose); useFocusIn(ref);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} onKeyDown={e => trapTab(e, ref.current)}>
        <header className="modal-head">
          <div><h2 id="modal-title">{title}</h2>{subtitle && <p className="muted small">{subtitle}</p>}</div>
          <button className="close-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
export function Drawer({ title, onClose, children, eyebrow, actions }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useEsc(onClose); useFocusIn(ref);
  return (
    <div className="overlay drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} onKeyDown={e => trapTab(e, ref.current)}>
        <header className="drawer-head">
          <div className="drawer-title-wrap">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 id="drawer-title">{title}</h2>
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close panel"><Icon name="x" /></button>
        </header>
        {actions && <div className="drawer-actions">{actions}</div>}
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

// ---------- Layout bits ----------
export function PageHead({ title, sub, actions, eyebrow }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Section({ title, aside, children, className = '', id }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section className={`section ${className}`} aria-labelledby={id}>
      <div className="section-head"><h2 id={id}>{title}</h2>{aside}</div>
      {children}
    </section>
  );
}
export function Empty({ title, children, action, icon = 'info' }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={20} />
      <div><strong>{title}</strong>{children && <p className="muted small">{children}</p>}{action && <div className="empty-action">{action}</div>}</div>
    </div>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; label: string }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={el => { refs.current[i] = el; }} role="tab" id={`tab-${t.id}`} aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1}
          className={`tab ${value === t.id ? 'on' : ''}`} onClick={() => onChange(t.id)}
          onKeyDown={e => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            const n = (i + d + tabs.length) % tabs.length; onChange(tabs[n].id); refs.current[n]?.focus();
          }}>
          {t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${pct}%` }} /></div>;
}

export function useMedia(q: string) {
  const [m, setM] = React.useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  React.useEffect(() => {
    const mq = matchMedia(q); const h = () => setM(mq.matches);
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

// ---------- Data table (cards on narrow screens) ----------
export interface Col<T> {
  key: string; header: string; render: (row: T) => React.ReactNode; sort?: (row: T) => string | number;
  className?: string; mobile?: 'title' | 'sub' | 'meta' | 'hide'; width?: string;
}
export function DataTable<T extends { id: string }>({ rows, cols, onOpen, empty, initialSort, label, rowLabel, pageSize }: {
  rows: T[]; cols: Col<T>[]; onOpen?: (r: T) => void; empty: React.ReactNode; initialSort?: { key: string; dir: 1 | -1 }; label: string; rowLabel?: (r: T) => string; pageSize?: number;
}) {
  const [sort, setSort] = React.useState(initialSort);
  const [limit, setLimit] = React.useState(pageSize ?? Infinity);
  const narrow = useMedia('(max-width: 760px)');
  const sorted = React.useMemo(() => {
    const c = cols.find(x => x.key === sort?.key);
    if (!c?.sort || !sort) return rows;
    const s = c.sort;
    return rows.slice().sort((a, b) => { const x = s(a), y = s(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, cols, sort]);
  if (!rows.length) return <>{empty}</>;
  const shown = sorted.length > limit ? sorted.slice(0, limit) : sorted;
  const more = sorted.length > shown.length ? (
    <div className="table-more"><span className="muted small">Showing {shown.length} of {sorted.length}</span><Button size="sm" onClick={() => setLimit(l => l + (pageSize ?? 50))}>Show more</Button><Button size="sm" variant="ghost" onClick={() => setLimit(Infinity)}>Show all</Button></div>
  ) : null;
  if (narrow) {
    const title = cols.find(c => c.mobile === 'title') ?? cols[0];
    const sub = cols.filter(c => c.mobile === 'sub');
    const meta = cols.filter(c => c.mobile === 'meta');
    return (
      <><ul className="card-list" aria-label={label}>
        {shown.map(r => (
          <li key={r.id}>
            <button type="button" className="card-row" onClick={() => onOpen?.(r)} aria-label={rowLabel?.(r)}>
              <div className="card-row-title">{title.render(r)}</div>
              {sub.length > 0 && <div className="card-row-sub">{sub.map(c => <span key={c.key}>{c.render(r)}</span>)}</div>}
              {meta.length > 0 && <dl className="card-row-meta">{meta.map(c => <div key={c.key}><dt>{c.header}</dt><dd>{c.render(r)}</dd></div>)}</dl>}
            </button>
          </li>
        ))}
      </ul>
      {more}</>
    );
  }
  return (
    <><div className="table-wrap">
      <table className="table" aria-label={label}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined} className={c.className} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button type="button" className="th-sort" onClick={() => setSort(s => ({ key: c.key, dir: s?.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                    {c.header}<span className="sort-ind" aria-hidden="true">{sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.id} className={onOpen ? 'clickable' : ''} onClick={e => {
              if (!onOpen) return;
              const t = e.target as HTMLElement;
              if (t.closest('button, select, input, a, label')) return;
              onOpen(r);
            }}>
              {cols.map((c, i) => (
                <td key={c.key} className={c.className}>
                  {i === 0 && onOpen ? <button type="button" className="row-open" onClick={() => onOpen(r)}>{c.render(r)}</button> : c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>{more}</>
  );
}

export function Confirm({ title, body, confirmLabel, onConfirm, onClose, danger }: { title: string; body: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Modal title={title} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}>
      <div className="prose">{body}</div>
    </Modal>
  );
}
