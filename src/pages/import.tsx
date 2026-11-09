import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Empty, Icon, PageHead, Section, SimTag, Tabs } from '../ui/kit';
import type { ActivityType, ExtractedRow, ImportBatch } from '../domain/types';
import { ACTIVITY_TYPES, CONTACT_ACTIVITY } from '../domain/types';
import { firmName, ix } from '../domain/derive';
import { analyzeRows, CSV_FIELDS, csvToRaw, parseCSV, RawRow, rowBlocking, rowStatus, SAMPLE_SCREENSHOTS, sampleCSV, sampleExtraction, visibleFirms } from '../domain/imports';
import { fmtDate, fmtDateTime, todayKey } from '../domain/time';
import * as M from '../domain/mutations';

type Stage = { step: 'upload' } | { step: 'review'; source: 'screenshot' | 'csv'; rows: ExtractedRow[]; sample: boolean } | { step: 'done'; result: M.ImportResult };

export function ImportPage() {
  const { tab, setTab } = useApp();
  const [stage, setStage] = React.useState<Stage>({ step: 'upload' });
  const t = (tab as 'screenshots' | 'csv') ?? 'screenshots';
  return (
    <div className="page">
      <PageHead title="Import activity" sub="Log many activities at once from screenshots of your email or from a spreadsheet. Nothing is saved until you confirm." />
      {stage.step === 'upload' && <>
        <Tabs label="Import source" value={t} onChange={setTab} tabs={[{ id: 'screenshots', label: 'Screenshots' }, { id: 'csv', label: 'CSV file' }]} />
        <div role="tabpanel" aria-labelledby={`tab-${t}`} className="tabpanel">
          {t === 'screenshots' ? <ScreenshotUpload onRows={(rows, sample) => setStage({ step: 'review', source: 'screenshot', rows, sample })} /> : <CsvUpload onRows={rows => setStage({ step: 'review', source: 'csv', rows, sample: false })} />}
        </div>
      </>}
      {stage.step === 'review' && <Review source={stage.source} initial={stage.rows} sample={stage.sample} onCancel={() => setStage({ step: 'upload' })} onDone={result => setStage({ step: 'done', result })} />}
      {stage.step === 'done' && <Done result={stage.result} onAgain={() => setStage({ step: 'upload' })} />}
      <History />
    </div>
  );
}

// ---------------- Screenshots ----------------
function ScreenshotUpload({ onRows }: { onRows: (rows: ExtractedRow[], sample: boolean) => void }) {
  const { db, personaId, tz, toast } = useApp();
  const [files, setFiles] = React.useState<{ name: string; url: string }[]>([]);
  const [drag, setDrag] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [err, setErr] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const add = (list: FileList | File[]) => {
    const imgs = Array.from(list).filter(f => f.type.startsWith('image/'));
    const rejected = Array.from(list).length - imgs.length;
    setErr(rejected ? `${rejected} file${rejected > 1 ? 's were' : ' was'} skipped. Upload PNG, JPG or other images.` : '');
    setFiles(fs => [...fs, ...imgs.map(f => ({ name: f.name || 'Pasted image', url: URL.createObjectURL(f) }))].slice(0, 12));
  };
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const items = Array.from(e.clipboardData?.files ?? []); if (items.length) { add(items); toast({ text: `Pasted ${items.length} image${items.length > 1 ? 's' : ''}.` }); } };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
  const extract = (sample: boolean) => {
    setExtracting(true);
    setTimeout(() => { setExtracting(false); onRows(analyzeRows(db, personaId, sampleExtraction(tz), tz), sample); }, 700);
  };
  return (
    <div className="import-grid">
      <div>
        <div className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
          <Icon name="upload" size={22} />
          <p><strong>Drag screenshots here</strong>, paste with Ctrl/⌘+V, or</p>
          <Button onClick={() => inputRef.current?.click()}>Choose images</Button>
          <input ref={inputRef} id="shot-input" type="file" accept="image/*" multiple className="sr-only" aria-label="Choose screenshot images" onChange={e => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
          <p className="muted small">Sent folder, inbox or LinkedIn message lists. Up to 12 images.</p>
        </div>
        {err && <p className="field-error" role="alert">{err}</p>}
        {files.length > 0 && (
          <div className="thumbs">
            {files.map((f, i) => <figure key={i}><img src={f.url} alt={`Uploaded screenshot ${i + 1}`} /><figcaption>{f.name}</figcaption><button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button></figure>)}
          </div>
        )}
        <div className="row-gap wrap">
          <Button variant="primary" disabled={!files.length || extracting} onClick={() => extract(false)}>{extracting ? 'Extracting…' : `Extract activity from ${files.length || ''} image${files.length === 1 ? '' : 's'}`}</Button>
          <Button disabled={extracting} onClick={() => extract(true)} icon="bolt">Try sample import</Button>
        </div>
        {extracting && <p className="muted small" role="status">Reading screenshots (simulated)…</p>}
      </div>
      <aside className="note-card">
        <SimTag>Simulated extraction</SimTag>
        <p>This prototype does not read your images. Extraction returns the same fixed sample rows for any upload, so you can try the review flow. Your images stay in this browser tab and are not saved.</p>
        <h3>In production</h3>
        <ul>
          <li>Images upload to private storage that only you can access.</li>
          <li>Extraction runs on the server. API keys never reach the browser.</li>
          <li>Images are processed only to extract activity details.</li>
          <li>Originals are deleted after you confirm. Abandoned uploads expire after 24 hours.</li>
          <li>Confirmed records stay after the images are deleted.</li>
        </ul>
        <p className="muted small">A screenshot is your own record. It does not independently verify that activity happened.</p>
      </aside>
    </div>
  );
}

// ---------------- CSV ----------------
function CsvUpload({ onRows }: { onRows: (rows: ExtractedRow[]) => void }) {
  const { db, personaId, tz } = useApp();
  const [text, setText] = React.useState('');
  const [mapping, setMapping] = React.useState<Record<string, number>>({});
  const parsed = React.useMemo(() => (text.trim() ? parseCSV(text) : []), [text]);
  const headers = parsed[0] ?? [];
  React.useEffect(() => {
    const m: Record<string, number> = {};
    for (const f of CSV_FIELDS) m[f.key] = headers.findIndex(h => f.guess.test(h));
    setMapping(m);
  }, [headers.join('|')]);
  const raws: RawRow[] = parsed.length > 1 ? csvToRaw(parsed, mapping) : [];
  const missingRequired = mapping.name < 0 || mapping.type < 0 || mapping.date < 0;
  return (
    <div className="import-grid">
      <div>
        <div className="row-gap wrap">
          <label className="btn btn-secondary btn-md" htmlFor="csv-file"><Icon name="upload" /> Choose CSV file</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(setText); e.target.value = ''; }} />
          <Button onClick={() => setText(sampleCSV(tz))}>Load sample CSV</Button>
        </div>
        <label htmlFor="csv-text" className="label">Or paste CSV text</label>
        <textarea id="csv-text" className="input mono" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'Name,Firm,Email,Activity,Date\nJane Doe,Evercore,jane@evercore.example,Initial outreach,2026-11-02'} />
        {parsed.length === 1 && <p className="field-error">Only a header row was found. Add at least one data row.</p>}
        {headers.length > 0 && parsed.length > 1 && <>
          <h3 className="h3">Match columns</h3>
          <div className="map-grid">
            {CSV_FIELDS.map(f => (
              <label key={f.key} className="map-row">
                <span>{f.label}{['name', 'type', 'date'].includes(f.key) && <span className="req-mark"> *</span>}</span>
                <select className="input input-sm" value={mapping[f.key] ?? -1} onChange={e => setMapping({ ...mapping, [f.key]: +e.target.value })}>
                  <option value={-1}>Not in file</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <h3 className="h3">Preview <span className="muted small">first {Math.min(5, raws.length)} of {raws.length} rows</span></h3>
          <div className="table-wrap"><table className="table small-table"><thead><tr><th>Name</th><th>Firm</th><th>Email</th><th>Activity</th><th>Date</th></tr></thead>
            <tbody>{raws.slice(0, 5).map((r, i) => <tr key={i}><td>{r.name || <span className="text-danger">Missing</span>}</td><td>{r.firmText ?? <span className="muted">—</span>}</td><td>{r.email ?? <span className="muted">—</span>}</td><td>{r.type ? ACTIVITY_TYPES[r.type] : <span className="text-danger">Not recognized</span>}</td><td>{r.date ? fmtDate(r.date) : <span className="text-danger">{r.dateHint ? `“${r.dateHint}”` : 'Missing'}</span>}</td></tr>)}</tbody></table></div>
          {missingRequired && <p className="field-error">Match the contact name, activity type and date columns to continue.</p>}
          <Button variant="primary" disabled={missingRequired || !raws.length} onClick={() => onRows(analyzeRows(db, personaId, raws, tz))}>Review {raws.length} rows</Button>
        </>}
      </div>
      <aside className="note-card">
        <h3>CSV format</h3>
        <p>One row per activity. Include a contact name, activity type and date. Firm and email help match existing contacts.</p>
        <p className="small muted">Dates: YYYY-MM-DD or M/D/YYYY. Text like “last week” is flagged for you to confirm.</p>
      </aside>
    </div>
  );
}

// ---------------- Review ----------------
function Review({ source, initial, sample, onCancel, onDone }: { source: 'screenshot' | 'csv'; initial: ExtractedRow[]; sample: boolean; onCancel: () => void; onDone: (r: M.ImportResult) => void }) {
  const { db, personaId, run, tz } = useApp();
  const [rows, setRows] = React.useState(initial);
  const firms = visibleFirms(db, personaId).filter(f => f.status !== 'merged').sort((a, b) => a.name.localeCompare(b.name));
  const upd = (i: number, p: Partial<ExtractedRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const included = rows.filter(r => r.include);
  const blocking = rows.filter(r => rowBlocking(db, r, rows));
  const confirm = () => {
    const res = run((d, a) => M.confirmImport(d, a, source, rows));
    if (res) onDone(res);
  };
  return (
    <Section title={`Review ${rows.length} extracted rows`} id="rv" aside={source === 'screenshot' ? <SimTag>{sample ? 'Sample screenshots, simulated extraction' : 'Simulated extraction: rows are sample data, not read from your images'}</SimTag> : <Badge tone="outline">CSV import</Badge>}>
      {source === 'screenshot' && (
        <div className="shot-strip" aria-label="Source screenshots">
          {SAMPLE_SCREENSHOTS.map(s => <div key={s.id} className="shot"><Icon name="file" size={14} /><span>{s.label}</span></div>)}
        </div>
      )}
      <div className="review-summary" role="status">
        <span><strong>{included.length}</strong> included</span>
        <span><strong>{rows.length - included.length}</strong> excluded</span>
        <span className={blocking.length ? 'text-danger' : ''}><strong>{blocking.length}</strong> need your review</span>
      </div>
      <div className="table-wrap review-wrap">
        <table className="table review-table">
          <thead><tr><th>Include</th><th>Contact and email</th><th>Firm</th><th>Activity</th><th>Date</th><th>Subject</th><th>Match</th></tr></thead>
          {rows.map((r, i) => {
            const st = rowStatus(db, r, rows);
            const matched = r.matchContactId ? ix(db).contact.get(r.matchContactId) : undefined;
            const sugg = r.suggestedContactId ? ix(db).contact.get(r.suggestedContactId) : undefined;
            const err = st.issues.some(x => x.level === 'error') && r.include;
            return (
              <tbody key={r.key} className={`rv-row ${!r.include ? 'excluded' : ''} ${err ? 'has-err' : ''}`}>
                <tr>
                  <td data-label="Include"><label className="check"><input type="checkbox" aria-label={`Include row ${i + 1}`} checked={r.include} onChange={e => upd(i, { include: e.target.checked })} /><span className="rv-n">{i + 1}</span></label></td>
                  <td data-label="Contact">
                    {matched && r.matchedBy === 'email' ? <span className="cell-strong">{matched.name}</span> : <input aria-label={`Contact name row ${i + 1}`} className="input input-sm" value={r.contactName} onChange={e => upd(i, { contactName: e.target.value })} />}
                    <div className="small muted rv-email">{r.email ?? 'Email not visible'}</div>
                    {sugg && !r.matchedBy && (
                      <select aria-label={`Match decision row ${i + 1}`} className={`input input-sm mt ${!r.suggestionDecision && r.include ? 'invalid' : ''}`} value={r.suggestionDecision ?? ''} onChange={e => { const v = e.target.value as 'match' | 'new' | ''; upd(i, { suggestionDecision: v || undefined, matchContactId: v === 'match' ? sugg.id : undefined }); }}>
                        <option value="">Same person?</option>
                        <option value="match">Yes: existing {sugg.name}</option>
                        <option value="new">No: new contact</option>
                      </select>
                    )}
                  </td>
                  <td data-label="Firm">
                    {matched ? firmName(db, matched.firmId) : (
                      <select aria-label={`Firm row ${i + 1}`} className={`input input-sm ${!r.firmId && r.include ? 'invalid' : ''}`} value={r.firmId ?? ''} onChange={e => upd(i, { firmId: e.target.value || undefined, suggestedContactId: undefined, suggestionDecision: undefined })}>
                        <option value="">{r.firmText ? `“${r.firmText}” not found` : 'Not visible'}</option>
                        {firms.map(f => <option key={f.id} value={f.id}>{f.name}{f.status === 'pending' ? ' (pending)' : ''}</option>)}
                      </select>
                    )}
                  </td>
                  <td data-label="Activity">
                    <select aria-label={`Activity type row ${i + 1}`} className={`input input-sm ${!r.type && r.include ? 'invalid' : ''}`} value={r.type} onChange={e => upd(i, { type: e.target.value as ActivityType })}>
                      <option value="">Choose…</option>
                      {CONTACT_ACTIVITY.map(t => <option key={t} value={t}>{ACTIVITY_TYPES[t]}</option>)}
                    </select>
                  </td>
                  <td data-label="Date"><input aria-label={`Date row ${i + 1}`} type="date" className={`input input-sm ${!r.date && r.include ? 'invalid' : ''}`} value={r.date ?? ''} max={todayKey(tz)} onChange={e => upd(i, { date: e.target.value || undefined })} />{r.dateHint && <div className="muted small">Shown as “{r.dateHint}”</div>}</td>
                  <td data-label="Subject" className="small subj">{r.subject ?? <span className="muted">—</span>}</td>
                  <td data-label="Match"><Badge tone={st.match.startsWith('Existing') ? 'green' : st.match.startsWith('New') ? 'blue' : st.match === 'Possible match' ? 'amber' : 'neutral'}>{st.match}</Badge></td>
                </tr>
                {st.issues.length > 0 && <tr className="rv-issues"><td aria-hidden="true" className="rv-pad" /><td colSpan={6} className="issues"><ul>{st.issues.map((x, k) => <li key={k} className={`issue-${x.level}`}><Icon name={x.level === 'error' ? 'alert' : 'info'} size={12} /> {x.text}</li>)}</ul></td></tr>}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="row-end sticky-actions">
        <Button onClick={onCancel}>Discard</Button>
        <Button variant="primary" disabled={!included.length || blocking.length > 0} onClick={confirm}>{blocking.length ? `Resolve ${blocking.length} row${blocking.length > 1 ? 's' : ''} to confirm` : `Confirm ${included.length} row${included.length === 1 ? '' : 's'}`}</Button>
      </div>
    </Section>
  );
}

function Done({ result, onAgain }: { result: M.ImportResult; onAgain: () => void }) {
  const { db, act, go, toast } = useApp();
  const batch = db.importBatches.find(b => b.id === result.batch.id);
  const undone = batch?.status === 'undone';
  return (
    <Section title={undone ? 'Import undone' : 'Import confirmed'} id="done">
      {undone ? <p>The records this import created were removed. Contacts and activity that existed before, or were logged afterwards, were kept.</p> : (
        <ul className="result-list">
          <li><strong>{result.created}</strong> activities logged</li>
          <li><strong>{result.newContacts}</strong> new contacts created</li>
          <li><strong>{result.skippedDuplicates}</strong> rows skipped because they were already logged</li>
          <li><strong>{result.resolvedFollowUps}</strong> follow-up reminder{result.resolvedFollowUps === 1 ? '' : 's'} resolved by a logged reply</li>
        </ul>
      )}
      <div className="row-gap wrap">
        {!undone && <Button icon="undo" onClick={() => { const r = act((d, a) => M.undoImport(d, a, result.batch.id)[0]); if (r) toast({ text: 'Import undone. Unrelated records were not changed.' }); }}>Undo this import</Button>}
        <Button variant="primary" onClick={() => go('recruiting', { tab: 'contacts' })}>View contacts</Button>
        <Button variant="ghost" onClick={onAgain}>Import more</Button>
      </div>
    </Section>
  );
}

function History() {
  const { db, personaId, act, tz, toast } = useApp();
  const batches = db.importBatches.filter(b => b.ownerId === personaId).slice().reverse();
  if (!batches.length) return null;
  return (
    <Section title="Import history" id="hist">
      <ul className="plain-list hist">
        {batches.map((b: ImportBatch) => (
          <li key={b.id} className="row-between">
            <span>{b.source === 'csv' ? 'CSV import' : 'Screenshot import'} · {fmtDateTime(b.confirmedAt, tz)} · {b.createdActivityIds.length} activities, {b.createdContactIds.length} new contacts {b.status === 'undone' && <Badge tone="neutral">Undone{b.undoKeptContactIds?.length ? `, kept ${b.undoKeptContactIds.length} contact with later activity` : ''}</Badge>}</span>
            {b.status === 'confirmed' && <Button size="sm" variant="ghost" icon="undo" onClick={() => act((d, a) => M.undoImport(d, a, b.id)[0]) && toast({ text: 'Import undone.' })}>Undo</Button>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
export { Empty };
