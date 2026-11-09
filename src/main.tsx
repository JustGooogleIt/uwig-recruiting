import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, Page, useApp } from './app/store';
import { Button, Confirm, Icon } from './ui/kit';
import { AddApplicationModal, AddContactModal, AddTargetModal, GoalModal, LogActivityModal, MockRequestModal, SubmitFirmModal } from './ui/forms';
import { Panels } from './ui/panels';
import { Overview } from './pages/overview';
import { RecruitingPage } from './pages/recruiting';
import { FirmsPage } from './pages/firms';
import { MocksPage } from './pages/mocks';
import { SettingsPage } from './pages/settings';
import { AllGroupsPage, MyGroupPage, WorkspacePage } from './pages/groups';
import { AdminPage } from './pages/admin';
import { ImportPage } from './pages/import';
import { AnnounceModal, BoardPage } from './pages/board';
import { DEMO_PERSONAS } from './domain/seed';
import { mentorAnalysts, ownerTasks } from './domain/derive';
import { todayKey } from './domain/time';
import logo from './assets/uwig-logo.png';

const NAV: { id: Page; label: string; icon: string; roles: string[] }[] = [
  { id: 'overview', label: 'Overview', icon: 'home', roles: ['analyst', 'mentor', 'exec'] },
  { id: 'board', label: 'Announcements', icon: 'flag', roles: ['analyst', 'mentor', 'exec'] },
  { id: 'recruiting', label: 'My Recruiting', icon: 'list', roles: ['analyst', 'mentor', 'exec'] },
  { id: 'firms', label: 'Explore Firms', icon: 'building', roles: ['analyst', 'mentor', 'exec'] },
  { id: 'mocks', label: 'Mock Interviews', icon: 'mic', roles: ['analyst', 'mentor', 'exec'] },
  { id: 'group', label: 'My Group', icon: 'users', roles: ['mentor'] },
  { id: 'groups', label: 'All Groups', icon: 'grid', roles: ['exec'] },
  { id: 'admin', label: 'Administration', icon: 'shield', roles: ['exec'] },
  { id: 'preferences', label: 'Settings', icon: 'gear', roles: ['analyst', 'mentor', 'exec'] },
];

function PersonaSwitcher() {
  const { db, personaId, setPersona, toast } = useApp();
  const quick = [
    { id: DEMO_PERSONAS.analyst, role: 'Analyst' },
    { id: DEMO_PERSONAS.mentor, role: 'Mentor' },
    { id: DEMO_PERSONAS.exec, role: 'Exec' },
  ];
  const others = db.members.filter(m => !quick.some(q => q.id === m.id));
  const pick = (id: string) => { setPersona(id); const m = db.members.find(x => x.id === id); toast({ text: `Now viewing as ${m?.name} (${m?.role}). Demo control only.` }); };
  return (
    <div className="persona" role="group" aria-label="Demo persona switcher">
      <span className="persona-label"><Icon name="info" size={13} /> Demo persona <span className="persona-note">not a sign-in</span></span>
      <div className="persona-quick">
        {quick.map(q => {
          const m = db.members.find(x => x.id === q.id)!;
          return <button key={q.id} className={`persona-btn ${personaId === q.id ? 'on' : ''}`} aria-pressed={personaId === q.id} onClick={() => pick(q.id)}><span>{q.role}</span><small>{m.name}</small></button>;
        })}
      </div>
      <select aria-label="View as another member" className="input input-sm persona-more" value={quick.some(q => q.id === personaId) ? '' : personaId} onChange={e => e.target.value && pick(e.target.value)}>
        <option value="">Other member…</option>
        {(['exec', 'mentor', 'analyst'] as const).map(r => <optgroup key={r} label={r[0].toUpperCase() + r.slice(1)}>{others.filter(m => m.role === r).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}
      </select>
    </div>
  );
}

function Shell() {
  const { db, me, page, go, modal, setModal, toasts, dismiss, viewingId, tz, reset } = useApp();
  const [navOpen, setNavOpen] = React.useState(false);
  const items = NAV.filter(n => n.roles.includes(me.role));
  const due = ownerTasks(db, me.id).filter(t => t.status === 'open' && t.dueOn <= todayKey(tz)).length;
  const pending = db.firms.filter(f => f.status === 'pending').length;
  const groupSize = me.role === 'mentor' ? mentorAnalysts(db, me.id).length : 0;
  const allowed = items.some(i => i.id === page) || page === 'import' || page === 'workspace';
  const current = allowed ? page : 'overview';
  React.useEffect(() => { setNavOpen(false); }, [page, me.id]);
  const nav = (
    <nav aria-label="Main">
      <ul className="nav">
        {items.map(n => (
          <li key={n.id}>
            <a href={`#${n.id}`} className={`nav-item ${current === n.id || (current === 'import' && n.id === 'recruiting') || (current === 'workspace' && (n.id === 'group' || n.id === 'groups')) ? 'on' : ''}`} aria-current={current === n.id ? 'page' : undefined}
              onClick={e => { e.preventDefault(); go(n.id); }}>
              <Icon name={n.icon} size={17} /><span>{n.label}</span>
              {n.id === 'overview' && due > 0 && <span className="nav-count" aria-label={`${due} follow-ups due`}>{due}</span>}
              {n.id === 'admin' && pending > 0 && <span className="nav-count" aria-label={`${pending} submissions to review`}>{pending}</span>}
              {n.id === 'group' && <span className="nav-meta">{groupSize}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Sidebar">
        <div className="brand"><img src={logo} alt="UWIG" /><span>Recruiting</span></div>
        {nav}
        <div className="side-foot">
          <div className="me"><span className="avatar" aria-hidden="true">{me.name.split(' ').map(s => s[0]).join('')}</span><span><strong>{me.name}</strong><small>{me.role[0].toUpperCase() + me.role.slice(1)}{me.role === 'analyst' ? ` · class of ${me.classYear}` : ''}</small></span></div>
          <p className="side-note">Prototype with fictional data.</p>
        </div>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(v => !v)}><Icon name="menu" size={20} /></button>
          <div className="mobile-brand"><img src={logo} alt="UWIG" /></div>
          <PersonaSwitcher />
          <Button size="sm" icon="refresh" className="demo-load" onClick={() => setModal({ kind: 'reset' })}>Load demo data</Button>
        </header>
        <main id="main" tabIndex={-1}>
          {current === 'overview' && <Overview />}
          {current === 'board' && <BoardPage />}
          {current === 'recruiting' && <RecruitingPage />}
          {current === 'import' && <ImportPage />}
          {current === 'firms' && <FirmsPage />}
          {current === 'mocks' && <MocksPage />}
          {current === 'preferences' && <SettingsPage />}
          {current === 'group' && <MyGroupPage />}
          {current === 'groups' && <AllGroupsPage />}
          {current === 'admin' && <AdminPage />}
          {current === 'workspace' && viewingId && <WorkspacePage />}
        </main>
      </div>
      {current !== 'import' && !modal && <button className="fab" onClick={() => setModal({ kind: 'log' })} aria-label="Log activity"><Icon name="plus" size={22} /><span>Log</span></button>}
      <Panels />
      {modal?.kind === 'log' && <LogActivityModal init={modal} />}
      {modal?.kind === 'addContact' && <AddContactModal init={modal} />}
      {modal?.kind === 'addApplication' && <AddApplicationModal init={modal} />}
      {modal?.kind === 'addTarget' && <AddTargetModal init={modal} />}
      {modal?.kind === 'submitFirm' && <SubmitFirmModal onClose={() => setModal(null)} initialName={modal.name} />}
      {modal?.kind === 'goal' && <GoalModal analystId={modal.analystId} goalId={modal.goalId} />}
      {modal?.kind === 'mock' && <MockRequestModal mentorId={modal.mentorId} />}
      {modal?.kind === 'announce' && <AnnounceModal id={modal.id} />}
      {modal?.kind === 'reset' && <Confirm title="Load the full demo data?" confirmLabel="Load demo data" onClose={() => setModal(null)}
        body={<><p>This fills every page with the fictional demo club: about 30 members, mentor groups, contacts, outreach, applications, goals, mock interviews, announcements and the firm directory.</p><p>Anything you added or changed in this browser is replaced. Nothing is sent anywhere.</p></>} onConfirm={reset} />}
      <div className="toasts" aria-live="polite" role="status">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} />
            <span>{t.text}</span>
            {t.action && <Button size="sm" variant="link" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</Button>}
            <button className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<AppProvider><Shell /></AppProvider>);
