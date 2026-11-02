import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Users, UserSquare2, Layers, School, Wallet, CheckCircle2, XCircle, Clock, MessageCircle, ArrowRight } from 'lucide-react';
import { api, money, fmtDate, todayISO } from '../../api.js';
import { PageHeader, StatCard, Card, Badge, Loading, EmptyState } from '../../components/ui.jsx';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const to = todayISO();
    const from = new Date(Date.now() + 5.5 * 3600e3 - 13 * 864e5).toISOString().slice(0, 10);
    Promise.all([api.get('/dashboard'), api.get('/reports/attendance-trend', { params: { from, to } })])
      .then(([d, t]) => {
        setData(d.data);
        setTrend(t.data.map((r) => ({ ...r, day: r.date.slice(5) })));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) return <Loading />;

  const { counts, attendanceToday: att, fees, recentPayments, recentNotifications } = data;
  const marked = att.present + att.absent + att.late;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview for ${fmtDate(todayISO())}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active students" value={counts.students} icon={Users} />
        <StatCard label="Teachers" value={counts.teachers} icon={School} tone="sky" />
        <StatCard label="Parents" value={counts.parents} icon={UserSquare2} tone="emerald" />
        <StatCard label="Batches" value={counts.batches} hint={`${counts.classes} classes`} icon={Layers} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Attendance */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Attendance — last 14 days</h2>
              <p className="text-xs text-slate-500">Present (incl. late) vs absent</p>
            </div>
            <Link to="/admin/reports" className="text-sm font-medium text-brand-600 hover:underline">Reports</Link>
          </div>
          <div className="mt-4 h-56">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pres" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(15,23,42,.12)' }} />
                  <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={2.5} fill="url(#pres)" />
                  <Area type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No attendance data yet" />
            )}
          </div>
        </Card>

        {/* Today */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Today's attendance</h2>
          <p className="text-xs text-slate-500">{marked} students marked so far</p>
          <div className="mt-5 space-y-4">
            {[
              { label: 'Present', value: att.present, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
              { label: 'Late', value: att.late, icon: Clock, cls: 'text-amber-600 bg-amber-50' },
              { label: 'Absent', value: att.absent, icon: XCircle, cls: 'text-rose-600 bg-rose-50' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`rounded-lg p-2 ${r.cls}`}><r.icon className="h-4 w-4" /></span>
                  <span className="text-sm font-medium text-slate-700">{r.label}</span>
                </div>
                <span className="text-lg font-bold text-slate-900">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-brand-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-brand-800">Pending fees ({fees.month})</span>
              <Wallet className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-1 text-2xl font-bold text-brand-900">{money(fees.pending + fees.overdue)}</p>
            <p className="text-xs text-brand-700">
              {fees.pendingCount} unpaid · {money(fees.overdue)} overdue · {money(fees.paid)} collected
            </p>
            <Link to="/admin/fees" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Manage fees <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>

        {/* Recent payments */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Recent payments</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {recentPayments.length === 0 && <EmptyState title="No payments recorded yet" />}
            {recentPayments.map((p) => (
              <li key={p._id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.student?.name}</p>
                  <p className="text-xs text-slate-500">{p.batch?.name} · {p.month} · {p.paymentMethod?.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">{money(p.amount)}</p>
                  <p className="text-xs text-slate-400">{fmtDate(p.paymentDate)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Recent notifications */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent WhatsApp notifications</h2>
            <MessageCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {recentNotifications.length === 0 && <EmptyState title="No notifications yet" hint="Absence alerts and fee reminders will appear here." />}
            {recentNotifications.map((n) => (
              <li key={n._id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{n.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {n.type.replace('_', ' ')} · {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <Badge value={n.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
