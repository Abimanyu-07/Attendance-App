import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { api, money, todayISO, currentMonth } from '../../api.js';
import { PageHeader, Card, Loading, EmptyState, Alert } from '../../components/ui.jsx';

const startOfMonth = () => `${currentMonth()}-01`;

export default function Reports() {
  const [range, setRange] = useState({ from: startOfMonth(), to: todayISO() });
  const [batch, setBatch] = useState('');
  const [batches, setBatches] = useState([]);
  const [att, setAtt] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [fees, setFees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setAtt(null);
    api.get('/reports/attendance', { params: { ...range, batch: batch || undefined } })
      .then(({ data }) => setAtt(data.items))
      .catch((e) => setError(e.message));
  }, [range, batch]);

  useEffect(() => {
    setFees(null);
    api.get('/fees/summary', { params: { month } }).then(({ data }) => setFees(data)).catch((e) => setError(e.message));
  }, [month]);

  const lowest = (att || []).slice(0, 10).map((r) => ({ name: r.name.split(' ')[0], percentage: r.percentage }));

  const exportCsv = () => {
    if (!att?.length) return;
    const header = ['Student ID', 'Name', 'Class', 'Present', 'Late', 'Absent', 'Total', 'Attendance %'];
    const lines = att.map((r) => [r.studentId, r.name, r.className, r.present, r.late, r.absent, r.total, r.percentage]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `attendance_${range.from}_${range.to}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Attendance performance and fee collection" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {/* Attendance */}
      <Card className="mb-6 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Attendance report</h2>
            <p className="text-xs text-slate-500">Students sorted by absences</p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <input type="date" className="input md:w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <input type="date" className="input md:w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <select className="input col-span-2 md:w-56" value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.classRef?.name} · {b.name} ({b.subject})</option>)}
            </select>
            <button className="btn-secondary col-span-2" onClick={exportCsv} disabled={!att?.length}><Download className="h-4 w-4" /> Export CSV</button>
          </div>
        </div>

        {!att ? <Loading /> : att.length === 0 ? <EmptyState title="No attendance in this range" /> : (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-72 lg:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Lowest attendance (top 10)</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={lowest} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: 'none' }} />
                  <Bar dataKey="percentage" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto lg:col-span-3">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70"><tr><th className="th">Student</th><th className="th">P</th><th className="th">L</th><th className="th">A</th><th className="th">Attendance</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {att.map((r) => (
                    <tr key={r.studentId}>
                      <td className="td"><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.className}</p></td>
                      <td className="td">{r.present}</td><td className="td">{r.late}</td><td className="td text-rose-600">{r.absent}</td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${r.percentage >= 75 ? 'bg-emerald-500' : r.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.percentage}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{r.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Fees by batch */}
      <Card className="p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Fee collection by batch</h2>
            <p className="text-xs text-slate-500">Paid, pending and overdue amounts for the selected month</p>
          </div>
          <input type="month" className="input sm:w-48" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {!fees ? <Loading /> : fees.batches.length === 0 ? <EmptyState title="No fees for this month" hint="Generate fees from the Fees page first." /> : (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-72 lg:col-span-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fees.batches.map((b) => ({ name: `${b.batch}`, Paid: b.paid, Pending: b.pending, Overdue: b.overdue }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: 'none' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Paid" stackId="a" fill="#10b981" />
                  <Bar dataKey="Pending" stackId="a" fill="#38bdf8" />
                  <Bar dataKey="Overdue" stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto lg:col-span-2">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/70"><tr><th className="th">Batch</th><th className="th text-right">Collected</th><th className="th text-right">Outstanding</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {fees.batches.map((b) => (
                    <tr key={b.batch + b.subject}>
                      <td className="td"><p className="font-medium text-slate-900">{b.batch}</p><p className="text-xs text-slate-400">{b.subject}</p></td>
                      <td className="td text-right font-semibold text-emerald-700">{money(b.paid)}</td>
                      <td className="td text-right text-rose-600">{money(b.pending + b.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
