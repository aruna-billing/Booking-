import { BADGE_MAX, BADGE_PRESETS, EMOJIS, badgeOf } from '../../lib/badges.js';
import { BadgeChip } from '../ui/BadgeChip.jsx';

/** Elegir la etiqueta de un plan o extra: ninguna, una de la lista o una propia. */
export function BadgePicker({ item, onChange, kind }) {
  // Lo elegido (aunque la etiqueta personalizada aún no tenga texto).
  const raw = item.badge !== undefined ? item.badge : item.featured ? BADGE_PRESETS[0] : null;
  const same = (p) => !!raw && p.emoji === raw.emoji && p.text === raw.text;
  const custom = !!raw && !BADGE_PRESETS.some(same);
  const current = badgeOf(item);

  return (
    <fieldset className="fieldset badge-picker" data-testid="badge-picker">
      <legend className="field__label">Etiqueta {kind === 'plan' ? 'del plan' : 'del extra'}</legend>
      <div className="badge-picker__opts" role="radiogroup" aria-label="Etiqueta">
        <button type="button" role="radio" aria-checked={!raw} className={`badge-opt ${!raw ? 'is-on' : ''}`} onClick={() => onChange(null)}>
          Sin etiqueta
        </button>
        {BADGE_PRESETS.map((p) => (
          <button key={p.text} type="button" role="radio" aria-checked={same(p)} className={`badge-opt ${same(p) ? 'is-on' : ''}`} onClick={() => onChange({ ...p })} data-testid={`badge-${p.text}`}>
            <span aria-hidden="true">{p.emoji}</span> {p.text}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          className={`badge-opt ${custom ? 'is-on' : ''}`}
          onClick={() => onChange(custom ? raw : { emoji: '✨', text: '' })}
          data-testid="badge-custom"
        >
          Personalizada…
        </button>
      </div>

      {custom && (
        <div className="badge-picker__custom">
          <label className="badge-picker__emoji">
            <span className="visually-hidden">Emoji</span>
            <select value={raw?.emoji ?? ''} onChange={(e) => onChange({ ...raw, emoji: e.target.value })} data-testid="badge-emoji">
              <option value="">Sin emoji</option>
              {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="badge-picker__text">
            <span className="visually-hidden">Texto de la etiqueta</span>
            <input
              value={raw?.text ?? ''}
              maxLength={BADGE_MAX}
              placeholder="Ej.: Ideal para parejas"
              onChange={(e) => onChange({ ...raw, text: e.target.value })}
              data-testid="badge-text"
            />
          </label>
        </div>
      )}
      {current && (
        <p className="muted small badge-picker__preview">
          Así se verá: <BadgeChip badge={current} />
        </p>
      )}
    </fieldset>
  );
}
