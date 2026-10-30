import { useState } from 'react';
import { Card, Toggle } from './parts.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { useToast } from '../ui/misc.jsx';
import { EMAIL_KINDS, EMAIL_VARS, LOGO_WIDTH, TERMS_MODES, defaultEmail, emailFooter, emailLogo, emailLogoSource, emailVars, fillTemplate, footerSettings, headerSettings, sampleRequest } from '../../lib/emails.js';
import { useDb } from '../../store/mockDb.js';
import { ImageUpload } from '../ui/ImageUpload.jsx';

const EMAIL_LOGO_OPTS = { accept: ['image/png', 'image/jpeg'], maxInputMB: 5, maxSide: 800, keepTransparency: true, quality: 0.9 };
import { LIVE } from '../../lib/mode.js';
import { sendTestEmail } from '../../services/cloud.js';

/** Correos automáticos al cliente: activar, editar asunto y mensaje, vista previa y prueba. */
export function EmailEditor({ brand, plan, value, onChange, dirty, number }) {
  const toast = useToast();
  const [kind, setKind] = useState('review');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const saved = value[kind] ?? {};
  const def = defaultEmail(kind, brand);
  const set = (patch) => onChange({ ...value, [kind]: { ...saved, ...patch } });
  const vars = emailVars(sampleRequest({ ...brand }, plan), brand);
  const subject = fillTemplate(saved.subject?.trim() ? saved.subject : def.subject, vars);
  const body = fillTemplate(saved.body?.trim() ? saved.body : def.body, vars);
  const enabled = saved.enabled !== false;
  const info = EMAIL_KINDS.find((k) => k.key === kind);
  const terms = useDb().terms?.[brand.id];
  const draftBrand = { ...brand, web: { ...brand.web, emails: value } };
  const foot = footerSettings(draftBrand);
  const setFoot = (patch) => onChange({ ...value, footer: { ...foot, ...patch } });
  const head = headerSettings(draftBrand);
  const setHead = (patch) => onChange({ ...value, header: { ...head, ...patch } });
  // Recién subido (aún sin guardar) el logo es un data URL: al guardar pasa a Storage.
  const chosen = emailLogoSource(draftBrand);
  const src = chosen?.src ?? '';
  const isSvg = /svg/i.test(chosen?.type ?? '') || /^data:image\/svg|\.svg(\?|#|$)/i.test(src);
  const logo = emailLogo(draftBrand) || (!isSvg && src.startsWith('data:image/') ? src : '');
  const svgLogo = !logo && isSvg;
  const footer = emailFooter(draftBrand, kind, terms, { acceptedTermsVersion: terms?.version });

  const test = async () => {
    setBusy(true);
    try {
      await sendTestEmail(brand.id, kind, to);
      toast(`Correo de prueba enviado a ${to}`, 'green');
    } catch (e) {
      toast(e.message, 'red');
    }
    setBusy(false);
  };

  return (
    <Card title={`${number} · Correos al cliente`} className="email-editor">
      <p className="muted small">
        Se envían solos desde la dirección configurada en Supabase (ver <code>docs/CORREOS.md</code>). Deja el asunto o el mensaje vacíos para usar el texto por defecto.
      </p>
      <div className="tabs" role="tablist" aria-label="Correo">
        {EMAIL_KINDS.map((k) => (
          <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} className={`tab ${kind === k.key ? 'is-active' : ''}`} onClick={() => setKind(k.key)} data-testid={`email-tab-${k.key}`}>
            {k.label}
            {value[k.key]?.enabled === false && <span className="muted small"> (apagado)</span>}
          </button>
        ))}
      </div>

      <div className="email-editor__grid">
        <div className="form">
          <Toggle checked={enabled} onChange={(v) => set({ enabled: v })} label={enabled ? 'Activo: se envía' : 'Apagado: no se envía'} />
          <p className="muted small">{info.when}</p>
          <Field label="Asunto" counter={saved.subject ? <button type="button" className="link-btn small" onClick={() => set({ subject: '' })}>Restaurar</button> : null}>
            <input value={saved.subject ?? ''} placeholder={def.subject} onChange={(e) => set({ subject: e.target.value })} data-testid="email-subject" />
          </Field>
          <Field label="Mensaje" counter={saved.body ? <button type="button" className="link-btn small" onClick={() => set({ body: '' })}>Restaurar</button> : null}>
            <textarea rows={12} value={saved.body ?? ''} placeholder={def.body} onChange={(e) => set({ body: e.target.value })} data-testid="email-body" />
          </Field>
          <details className="email-editor__vars">
            <summary>Datos que se rellenan solos</summary>
            <ul>
              {EMAIL_VARS.map(([k, label]) => (
                <li key={k}><code>{`{${k}}`}</code> {label}</li>
              ))}
            </ul>
          </details>

          <fieldset className="email-editor__footer">
            <legend>Logo y pie (los dos correos)</legend>
            <ImageUpload
              label="Logo para correos (opcional)"
              hint="PNG o JPG. Si no subes uno, se usa el logo de Marcas."
              value={value.logo ?? null}
              onChange={(img) => onChange({ ...value, logo: img })}
              options={EMAIL_LOGO_OPTS}
              aspect="3 / 1"
              fit="contain"
              background="#ffffff"
              testId="email-logo"
            />
            <p className="muted small">
              {logo
                ? value.logo?.src ? 'Arriba va el logo para correos.' : 'Arriba va el logo de la marca (Marcas → Logo).'
                : svgLogo
                  ? 'El logo de Marcas es SVG y Gmail/Outlook no lo muestran: arriba va el nombre de la marca. Sube aquí un logo para correos en PNG o JPG.'
                  : 'Sin logo: arriba va el nombre de la marca. Sube aquí un logo para correos (PNG o JPG).'}
            </p>
            <div className="email-editor__head">
              <Field label="Posición del logo">
                <div className="seg" role="radiogroup" aria-label="Posición del logo">
                  {[['left', 'Izquierda'], ['center', 'Centrado']].map(([k, label]) => (
                    <label key={k} className={`seg__opt ${head.align === k ? 'is-on' : ''}`}>
                      <input type="radio" name="email-logo-align" checked={head.align === k} onChange={() => setHead({ align: k })} data-testid={`email-logo-align-${k}`} /> {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={`Tamaño del logo: ${head.logoWidth} px de ancho`}>
                <input type="range" min={LOGO_WIDTH.min} max={LOGO_WIDTH.max} step={LOGO_WIDTH.step} value={head.logoWidth} onChange={(e) => setHead({ logoWidth: Number(e.target.value) })} disabled={!logo} data-testid="email-logo-width" />
              </Field>
            </div>
            <Toggle checked={foot.enabled} onChange={(v) => setFoot({ enabled: v })} label={foot.enabled ? 'Pie con contacto y términos' : 'Sin pie'} />
            {foot.enabled && (
              <Field label="Términos en el pie" hint={terms?.sections?.length ? `Se usan los de «Términos» (versión ${terms.version}).` : 'Esta marca aún no tiene términos guardados: solo sale el contacto.'}>
                <select value={foot.terms} onChange={(e) => setFoot({ terms: e.target.value })} data-testid="email-footer-terms">
                  {TERMS_MODES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </Field>
            )}
          </fieldset>
        </div>

        <div className="email-editor__preview" aria-label="Vista previa del correo">
          <p className="field__label">Vista previa (con datos de ejemplo)</p>
          <div className={`email-preview ${enabled ? '' : 'is-off'}`} data-testid="email-preview">
            <p className="email-preview__subject"><span className="muted small">Asunto:</span> {subject}</p>
            <div className="email-preview__body" style={{ borderTopColor: brand.theme?.accent }}>
              <div className="email-preview__logo" style={{ textAlign: head.align }} data-testid="email-preview-logo">
                {logo ? <img src={logo} alt={brand.name} style={{ width: head.logoWidth, display: head.align === 'center' ? 'inline-block' : 'block' }} /> : <strong>{brand.name}</strong>}
              </div>
              {body.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>
              ))}
              {footer?.terms && (
                <div className="email-preview__terms" data-testid="email-preview-terms">
                  <p><strong>{footer.terms.title}</strong></p>
                  {footer.terms.sections.map((x, i) => (
                    <p key={i}>{x.title && <strong>{x.title}. </strong>}{x.body}</p>
                  ))}
                </div>
              )}
            </div>
            {footer && (
              <div className="email-preview__foot" data-testid="email-preview-foot">
                <p>{footer.contact.join(' · ')}</p>
                {footer.accepted && <p>{footer.accepted}</p>}
              </div>
            )}
          </div>
          {LIVE ? (
            <div className="email-editor__test">
              <Field label="Enviar una prueba a" hint={dirty ? 'Guarda los cambios antes: la prueba usa los textos guardados.' : 'Llega con «[Prueba]» en el asunto.'}>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="tu@correo.com" data-testid="email-test-to" />
              </Field>
              <Button variant="secondary" size="sm" onClick={test} loading={busy} disabled={!to.trim() || dirty} data-testid="email-test-send">
                Enviar prueba
              </Button>
            </div>
          ) : (
            <p className="muted small">En la demo no se envían correos. Con Supabase y Resend configurados, aquí puedes mandarte una prueba.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
