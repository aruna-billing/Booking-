import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAdmin } from '../../components/admin/AdminLayout.jsx';
import { Card, PageHeader } from '../../components/admin/parts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { DemoNotice, useToast } from '../../components/ui/misc.jsx';
import { TermsModal } from '../../components/booking/TermsModal.jsx';
import { formatShortDate } from '../../lib/date.js';
import * as api from '../../services/api.js';

export function TermsAdmin() {
  const db = useDb();
  const { brandFilter } = useAdmin();
  const [pick, setPick] = useState(db.brands[0].id);
  const wanted = brandFilter !== 'all' ? brandFilter : pick;
  const brandId = db.brands.some((b) => b.id === wanted) ? wanted : db.brands[0].id;
  const brand = db.brands.find((b) => b.id === brandId);
  const terms = db.terms[brandId];

  return (
    <>
      <PageHeader title="Términos y condiciones" description="Cada marca tiene sus propios términos. El cliente debe aceptarlos antes de pagar; se guarda la versión aceptada." />
      <DemoNotice compact live="El cliente acepta la versión publicada al reservar. Asegúrate de que sea el texto oficial de tu estudio.">Texto de ejemplo. Debe revisarlo un profesional legal antes de usarse con clientes reales.</DemoNotice>
      {brandFilter === 'all' && (
        <div className="tabs" role="tablist" aria-label="Marca">
          {db.brands.map((b) => (
            <button key={b.id} role="tab" type="button" aria-selected={brandId === b.id} className={`tab ${brandId === b.id ? 'is-active' : ''}`} onClick={() => setPick(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <TermsEditor key={`${brandId}-${terms.version}`} brand={brand} terms={terms} />
    </>
  );
}

function TermsEditor({ brand, terms }) {
  const toast = useToast();
  const [sections, setSections] = useState(terms.sections);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(sections) !== JSON.stringify(terms.sections);
  const invalid = sections.some((s) => !s.title.trim() || !s.body.trim());

  const update = (i, patch) => setSections((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, d) =>
    setSections((list) => {
      const next = [...list];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <Card
      title={`${brand.name} · versión ${terms.version}`}
      actions={<span className="muted small">Actualizada {formatShortDate(terms.updatedAt)}</span>}
    >
      <ol className="terms-editor">
        {sections.map((s, i) => (
          <li key={i} className="terms-editor__item">
            <div className="terms-editor__fields">
              <Field label={`Sección ${i + 1}: título`} required error={!s.title.trim() ? 'Escribe un título.' : undefined}>
                <input value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
              </Field>
              <Field label="Contenido" required error={!s.body.trim() ? 'Escribe el contenido.' : undefined}>
                <textarea rows={3} value={s.body} onChange={(e) => update(i, { body: e.target.value })} />
              </Field>
            </div>
            <div className="terms-editor__tools">
              <button type="button" className="icon-btn icon-btn--sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir sección ${i + 1}`}>↑</button>
              <button type="button" className="icon-btn icon-btn--sm" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar sección ${i + 1}`}>↓</button>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setSections((l) => l.filter((_, j) => j !== i))} aria-label={`Eliminar sección ${i + 1}`}>✕</button>
            </div>
          </li>
        ))}
      </ol>
      <div className="form__actions">
        <Button variant="ghost" onClick={() => setSections((l) => [...l, { title: '', body: '' }])}>+ Añadir sección</Button>
        <span className="spacer" />
        <Button variant="secondary" onClick={() => setPreview(true)}>Vista previa</Button>
        <Button
          disabled={!dirty || invalid}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const saved = await api.saveTerms(brand.id, sections);
            if (saved === false) {
              setBusy(false);
              return toast(api.SAVE_FAILED, 'red');
            }
            toast('Nueva versión publicada', 'green');
          }}
        >
          Publicar nueva versión
        </Button>
      </div>
      <TermsModal open={preview} onClose={() => setPreview(false)} brand={brand} terms={{ ...terms, sections }} />
    </Card>
  );
}
