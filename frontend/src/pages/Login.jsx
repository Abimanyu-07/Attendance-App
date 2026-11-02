import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Phone, Lock, ArrowRight } from 'lucide-react';
import { useAuth, homeFor } from '../auth.jsx';
import { Alert, Spinner } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(phone.trim(), password);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <School className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold">Smart Tuition Centre</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Attendance, fees and parent updates, all in one place.</h2>
          <p className="mt-4 text-brand-100">
            Teachers mark attendance from their phones in seconds. Parents receive WhatsApp alerts the moment something needs attention.
          </p>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} Smart Tuition Centre</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600">
              <School className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Smart Tuition Centre</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your registered mobile number.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="label" htmlFor="phone">Mobile number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="phone" className="input pl-10" inputMode="tel" autoComplete="username" placeholder="9000000001" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="password" type="password" className="input pl-10" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Spinner className="h-4 w-4 text-white" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">Forgot your password? Ask the centre admin to reset it.</p>
        </div>
      </div>
    </div>
  );
}
