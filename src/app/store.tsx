// App state container. The `Repository` boundary is the seam for production:
// swap LocalRepository for a Supabase-backed one and route each mutation to a server action.
import React from 'react';
import type { DB, Member } from '../domain/types';
import { DB_VERSION, DEMO_PERSONAS, seedDB } from '../domain/seed';
import { PermissionError } from '../domain/permissions';

const KEY = 'uwig-recruiting-demo';
export interface Persisted { db: DB; personaId: string }

interface Repository { load(): Persisted | null; save(p: Persisted): void; clear(): void; mode: 'local' | 'memory' }
function makeRepo(): Repository {
  let ok = false;
  try { const k = '__uwig_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); ok = true; } catch { ok = false; }
  let mem: Persisted | null = null;
  return {
    mode: ok ? 'local' : 'memory',
    load() {
      if (!ok) return mem;
      try { const raw = localStorage.getItem(KEY); if (!raw) return null; const p = JSON.parse(raw) as Persisted; return p.db?.version === DB_VERSION ? p : null; } catch { return null; }
    },
    save(p) { mem = p; if (!ok) return; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota or blocked: keep in memory */ } },
    clear() { mem = null; if (ok) try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  };
}
export const repo = makeRepo();

export type Page = 'overview' | 'board' | 'recruiting' | 'import' | 'firms' | 'mocks' | 'preferences' | 'group' | 'groups' | 'admin' | 'workspace';
export type Panel = { kind: 'contact'; id: string } | { kind: 'application'; id: string } | { kind: 'firm'; id: string } | null;
export type Modal =
  | { kind: 'log'; contactId?: string; applicationId?: string; type?: string }
  | { kind: 'addContact'; firmId?: string; logOutreach?: boolean; name?: string; email?: string; source?: string }
  | { kind: 'addApplication'; firmId?: string }
  | { kind: 'announce'; id?: string }
  | { kind: 'addTarget'; firmId?: string }
  | { kind: 'submitFirm'; name?: string; onCreated?: (firmId: string) => void }
  | { kind: 'goal'; analystId: string; goalId?: string }
  | { kind: 'mock'; mentorId: string }
  | { kind: 'reset' }
  | null;
export interface Toast { id: number; text: string; tone?: 'ok' | 'error'; action?: { label: string; run: () => void } }

interface Ctx {
  db: DB; me: Member; personaId: string; setPersona: (id: string) => void;
  page: Page; go: (p: Page, opts?: { analystId?: string; tab?: string }) => void;
  tab: string | undefined; setTab: (t: string) => void;
  viewingId?: string;
  panel: Panel; setPanel: (p: Panel) => void;
  modal: Modal; setModal: (m: Modal) => void;
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void;
  /** Run a mutation as the current persona. Errors become toasts; returns true on success. */
  act: (fn: (db: DB, actor: string) => DB) => boolean;
  run: <T,>(fn: (db: DB, actor: string) => [DB, T]) => T | undefined;
  reset: () => void;
  tz: string;
}
const AppCtx = React.createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => React.useContext(AppCtx);

const PAGES: Page[] = ['overview', 'board', 'recruiting', 'import', 'firms', 'mocks', 'preferences', 'group', 'groups', 'admin'];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(() => repo.load() ?? { db: seedDB(), personaId: DEMO_PERSONAS.analyst });
  const [page, setPage] = React.useState<Page>(() => {
    const h = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Page;
    return PAGES.includes(h) ? h : 'overview';
  });
  const [tab, setTab] = React.useState<string | undefined>();
  const [viewingId, setViewingId] = React.useState<string | undefined>();
  const [panel, setPanel] = React.useState<Panel>(null);
  const [modal, setModal] = React.useState<Modal>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => { repo.save(state); }, [state]);
  React.useEffect(() => {
    const on = () => { const h = location.hash.slice(1) as Page; if (PAGES.includes(h)) { setPage(h); setPanel(null); } };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const me = state.db.members.find(m => m.id === state.personaId) ?? state.db.members[0];
  const toastId = React.useRef(0);
  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current;
    setToasts(ts => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.action ? 9000 : 4500);
  }, []);
  const dismiss = React.useCallback((id: number) => setToasts(ts => ts.filter(x => x.id !== id)), []);

  const run = React.useCallback(<T,>(fn: (db: DB, actor: string) => [DB, T]): T | undefined => {
    try {
      const cur = stateRef.current;
      const [db, out] = fn(cur.db, cur.personaId);
      const next = { ...cur, db };
      stateRef.current = next;
      setState(next);
      return out;
    } catch (e) {
      toast({ text: e instanceof PermissionError || e instanceof Error ? e.message : 'Something went wrong. Try again.', tone: 'error' });
      return undefined;
    }
  }, [toast]);
  const act = React.useCallback((fn: (db: DB, actor: string) => DB) => run((db, a) => [fn(db, a), true]) === true, [run]);

  const go = React.useCallback((p: Page, opts?: { analystId?: string; tab?: string }) => {
    setPage(p); setPanel(null); setTab(opts?.tab);
    if (p === 'workspace') setViewingId(opts?.analystId);
    if (p !== 'workspace') { try { history.replaceState(null, '', '#' + p); } catch { /* sandboxed */ } }
    window.scrollTo?.({ top: 0 });
  }, []);
  const setPersona = React.useCallback((id: string) => {
    setState(s => ({ ...s, personaId: id }));
    setPanel(null); setModal(null); setViewingId(undefined);
    const role = stateRef.current.db.members.find(m => m.id === id)?.role;
    setPage(p => ((p === 'group' && role !== 'mentor') || ((p === 'groups' || p === 'admin') && role !== 'exec') || p === 'workspace' ? 'overview' : p));
  }, []);
  const reset = React.useCallback(() => {
    repo.clear();
    setState(s => ({ db: seedDB(), personaId: s.personaId }));
    setPanel(null); setModal(null); setViewingId(undefined); setPage('overview');
    toast({ text: 'Demo data loaded. Every page now shows the fictional demo club.' });
  }, [toast]);

  const value: Ctx = {
    db: state.db, me, personaId: state.personaId, setPersona, page, go, tab, setTab, viewingId,
    panel, setPanel, modal, setModal, toasts, toast, dismiss, act, run, reset, tz: me.timezone,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
