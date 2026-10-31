import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Route, Scale, Merge } from 'lucide-react';
import { useAuth } from '../store/useAuth';
import { errMsg } from '../services/api';
import { Spinner } from '../components/ui';
import { Logo } from '../components/Sidebar';

export default function AuthPage() {
  const { user, authenticate } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await authenticate(mode, mode === 'login' ? { email: form.email, password: form.password } : form); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-violet/25 blur-[110px]" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-cyan/20 blur-[110px]" />
        <div className="relative flex items-center gap-3"><Logo size={34} /><span className="font-display text-lg font-semibold text-white">Agent Workspace</span></div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-white">One question. Several specialists. One better answer.</h1>
          <ul className="mt-8 space-y-5 text-zinc-300">
            {[[Route, 'A router picks the agents and models that fit your prompt.'], [Scale, 'A critic scores every answer so you can see where they disagree.'], [Merge, 'A synthesizer merges the strongest parts into one final answer.']].map(([I, t], i) => (
              <li key={i} className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-violet-soft"><I size={16} /></span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-zinc-500">Bring your own API keys. They are encrypted on the server and never sent back to the browser.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-4">
          <div className="mb-2 flex items-center gap-3 lg:hidden"><Logo size={32} /><span className="font-display font-semibold text-white">Agent Workspace</span></div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="mt-1 text-sm text-zinc-400">{mode === 'login' ? 'Sign in to continue your conversations.' : 'It takes less than a minute.'}</p>
          </div>
          {mode === 'register' && <div><label className="label" htmlFor="u">Username</label><input id="u" className="field" value={form.username} onChange={set('username')} required minLength={3} maxLength={30} autoComplete="username" /></div>}
          <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" className="field" value={form.email} onChange={set('email')} required autoComplete="email" /></div>
          <div><label className="label" htmlFor="p">Password</label><input id="p" type="password" className="field" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode === 'register' && <p className="mt-1.5 text-xs text-zinc-500">At least 8 characters.</p>}</div>
          {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />}{mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="text-center text-sm text-zinc-400">{mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="font-semibold text-cyan-soft hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        </motion.form>
      </div>
    </div>
  );
}
