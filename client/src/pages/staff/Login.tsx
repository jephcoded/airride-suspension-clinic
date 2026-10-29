import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Alert, Logo } from '../../components/ui/misc';
import { useSeo } from '../../lib/useSeo';

export default function Login() {
  useSeo();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/staff';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (me) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      qc.setQueryData(['me'], data);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-900 bg-tread p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo light /></div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-6 shadow-lift sm:p-8">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold"><Lock className="size-5 text-brand-500" /> Staff sign in</h1>
            <p className="mt-1 text-sm text-navy-500">Workshop dashboard for technicians, advisors and management.</p>
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
        </form>
      </div>
    </div>
  );
}
