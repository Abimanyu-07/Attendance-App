import { useEffect, useState } from 'react';
import { CalendarCheck, Wallet, GraduationCap, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api, money, fmtDate, currentMonth } from '../../api.js';
import { Card, Badge, Loading, EmptyState, Alert } from '../../components/ui.jsx';

export default function ParentHome() {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null); // selected child id
  const [tab, setTab] = useState('attendance');
  const [month, setMonth] = useState(currentMonth());
  const [attendance, setAttendance] = useState(null);
  const [fees, setFees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/parent/children')
      .then(({ data }) => {
        setData(data);
        if (data.children.length) setActive(data.children[0]._id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!active) return;
    setAttendance(null);
    api.get(`/parent/children/${active}/attendance`, { params: { month } }).then(({ data }) => setAttendance(data)).catch((e) => setError(e.message));
  }, [active, month]);

  useEffect(() => {
    if (!active) return;
    setFees(null);
    api.get(`/parent/children/${active}/fees`).then(({ data }) => setFees(data)).catch((e) => setError(e.message));
  }, [active]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;

  const child = data.children.find((c) => c._id === active);

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-600">Parent portal</p>
        <h1 className="text-2xl font-bold text-slate-900">Hello, {data.parent.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">View your child's attendance and fee status.</p>
      </div>

      {data.children.length === 0 ? (
        <Card><EmptyState title="No children linked yet" hint="Please contact the centre office." /></Card>
      ) : (
        <>
          {/* Child switcher */}
          <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
            {data.children.map((c) => (
              <button key={c._id} onClick={() => setActive(c._id)}
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${active === c._id ? 'bg-brand-600 text-white ring-brand-600 shadow-lg shadow-brand-200' : 'bg-white text-slate-800 ring-slate-200'}`}>
                <GraduationCap className="h-5 w-5 opacity-80" />
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className={`text-xs ${active === c._id ? 'text-brand-100' : 'text-slate-500'}`}>{c.grade?.name} · {c.batches.length} batch(es)</p>
                </div>
              </button>
            ))}
          </div>

          {child && (
            <Card className="mb-5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{child.name}</p>
                  <p className="text-sm text-slate-500">{child.studentId} · {child.grade?.name}</p>
                </div>
                <Badge value={child.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {child.batches.map((b) => (
                  <span key={b._id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {b.name} · {b.subject} · {b.days.join('/')} {b.startTime}–{b.endTime}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Tabs */}
          <div className="mb-4 inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {[{ k: 'attendance', l: 'Attendance', i: CalendarCheck }, { k: 'fees', l: 'Fees', i: Wallet }].map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.k ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600'}`}>
                <t.i className="h-4 w-4" /> {t.l}
              </button>
            ))}
          </div>

          {tab === 'attendance' && (
            <Card className="p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Attendance rate</p>
                  <p className="text-3xl font-bold text-slate-900">{attendance ? `${attendance.percentage}%` : '—'}</p>
                </div>
                <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              {!attendance ? <Loading /> : attendance.records.length === 0 ? <EmptyState title="No attendance recorded for this month" /> : (
                <ul className="divide-y divide-slate-100">
                  {attendance.records.map((r) => {
                    const Icon = r.status === 'absent' ? XCircle : r.status === 'late' ? Clock : CheckCircle2;
                    const tone = r.status === 'absent' ? 'text-rose-500' : r.status === 'late' ? 'text-amber-500' : 'text-emerald-500';
                    return (
                      <li key={r._id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${tone}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{fmtDate(r.date)}</p>
                            <p className="text-xs text-slate-500">{r.batch?.name} · {r.batch?.subject}</p>
                          </div>
                        </div>
                        <Badge value={r.status} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {tab === 'fees' && (
            <Card className="p-5">
              {!fees ? <Loading /> : (
                <>
                  <div className={`mb-5 rounded-2xl p-4 ${fees.outstanding > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${fees.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Outstanding balance</p>
                    <p className={`text-3xl font-bold ${fees.outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(fees.outstanding)}</p>
                    {fees.outstanding === 0 && <p className="mt-1 text-sm text-emerald-700">All fees are paid. Thank you!</p>}
                  </div>
                  {fees.fees.length === 0 ? <EmptyState title="No fee records yet" /> : (
                    <ul className="divide-y divide-slate-100">
                      {fees.fees.map((f) => (
                        <li key={f._id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{f.month} · {f.batch?.name}</p>
                            <p className="text-xs text-slate-500">
                              {f.status === 'paid' ? `Paid on ${fmtDate(f.paymentDate)} (${f.paymentMethod?.toUpperCase()})` : `Due ${fmtDate(f.dueDate)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{money(f.amount)}</p>
                            <Badge value={f.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
