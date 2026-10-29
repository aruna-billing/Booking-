import { useState } from 'react';
import { useDb } from '../../store/mockDb.js';
import { useAuthState } from '../../lib/auth.js';
import { signIn } from '../../services/session.js';
import { OrgMark } from '../../components/ui/BrandMark.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Link, navigate } from '../../lib/router.jsx';

/** Acceso del equipo (Supabase Auth). Las cuentas se crean en Supabase → Authentication. */
export function AdminLogin({ next = '/admin' }) {
  const { organization: org } = useDb();
  const auth = useAuthState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shown = error || auth.error;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate(next === '/admin/login' ? '/admin' : next, { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  }

  return (
    <main className="login" data-testid="login">
      <div className="login__card">
        <div className="login__logo">
          <OrgMark org={org} size="md" />
        </div>
        <h1 className="login__title">Acceso del equipo</h1>
        <p className="muted">Entra con el correo y la contraseña que te dio el administrador.</p>
        <form className="form" onSubmit={submit} noValidate>
          {shown && (
            <p className="callout callout--red" role="alert" data-testid="login-error">
              {shown}
            </p>
          )}
          <Field label="Correo electrónico" required>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
          </Field>
          <Field label="Contraseña" required>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" />
          </Field>
          <Button type="submit" block loading={busy} disabled={!email || !password} data-testid="login-submit">
            Iniciar sesión
          </Button>
        </form>
        <p className="small muted login__help">¿Olvidaste tu contraseña? Pide a un administrador que la cambie en Supabase.</p>
        <Link to="/" className="small">← Volver al sitio</Link>
      </div>
    </main>
  );
}
