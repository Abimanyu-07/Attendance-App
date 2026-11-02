import { useEffect, useState, useCallback } from 'react';
import { Wallet, CheckCircle2, AlertTriangle, Clock, Search, Send, RefreshCw, Undo2, Receipt } from 'lucide-react';
import { api, money, fmtDate, todayISO, currentMonth } from '../../api.js';
import { PageHeader, StatCard, Card, Badge, Modal, Field, Loading, EmptyState, Alert } from '../../components/ui.jsx';

const METHODS = ['cash', 'upi', 'bank', 'card', 'other'];

export default function Fees() {
  const [filters, setFilters] = useState({ month: currentMonth(), status: '', batch: '', search: '', page: 1 });
  const [data, setData] = useState(null);
  const [batches, setBatches] = useState([]);
  const [paying, setPaying] = useState(null);
  const [payForm, setPayForm] = useState({ paymentDate: todayISO(), paymentMethod: 'cash', reference: '' });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [searchText, setSearchText] = useState('');

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries({ ...filters, limit: 20 }).filter(([, v]) => v !== ''));
    api.get('/fees', { params }).then(({ data }) => setData(data)).catch((e) => setNotice({ kind: 'error', text: e.message }));
  }, [filters]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchText, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const run = async (fn, okText) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      setNotice({ kind: 'ok', text: okText ? okText(res.data) : 'Done' });
      load();
    } catch (e) {
      setNotice({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const generate = () => run(() => api.post('/fees/generate', { month: filters.month }), (d) => d.message);
  const remind = () => {
    if (!confirm(`Send WhatsApp reminders to parents for all unpaid fees in ${filters.month}?`)) return;
    run(() => api.post('/fees/reminders', { month: filters.month }), (d) => d.message);
  };
  const submitPayment = (e) => {
    e.preventDefault();
    run(() => api.post(`/fees/${paying._id}/pay`, payForm), () => 'Payment recorded and receipt queued to parent').then(() => setPaying(null));
  };
  const reopen = (f) => {
    if (!confirm('Mark this fee as unpaid again?')) return;
    run(() => api.post(`/fees/${f._id}/reopen`), () => 'Payment reversed');
  };

  const s = data?.summary || {};
  const chip = (value, label) => (
    <button onClick={() => setFilters({ ...filters, status: value, page: 1 })}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${filters.status === value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle="Track monthly fees per student and batch"
        actions={
          <>
            <button className="btn-secondary" onClick={generate} disabled={busy}><RefreshCw className="h-4 w-4" /> Generate {filters.month}</button>
            <button className="btn-primary" onClick={remind} disabled={busy || !data}><Send className="h-4 w-4" /> Send reminders</button>
          </>
        }
      />

      {notice && <div className="mb-4"><Alert kind={notice.kind === 'ok' ? 'ok' : 'error'}>{notice.text}</Alert></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected" value={money(s.paid)} hint={`${s.paidCount || 0} payments`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Pending" value={money(s.pending)} hint={`${s.pendingCount || 0} fees`} icon={Clock} tone="sky" />
        <StatCard label="Overdue" value={money(s.overdue)} hint={`${s.overdueCount || 0} fees`} icon={AlertTriangle} tone="rose" />
        <StatCard label="Total billed" value={money((s.paid || 0) + (s.pending || 0) + (s.overdue || 0))} icon={Wallet} tone="amber" />
      </div>

      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search by student name…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <input type="month" className="input" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value, page: 1 })} />
          <select className="input" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value, page: 1 })}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.subject}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chip('', 'All')}{chip('overdue', 'Overdue')}{chip('pending', 'Pending')}{chip('paid', 'Paid')}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {!data ? <Loading /> : data.items.length === 0 ? (
          <EmptyState title="No fee records for this filter" hint="Click “Generate” to create fees for this month." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr><th className="th">Student</th><th className="th">Batch</th><th className="th">Month</th><th className="th">Amount</th><th className="th">Due</th><th className="th">Status</th><th className="th text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.items.map((f) => (
                    <tr key={f._id} className="hover:bg-slate-50/60">
                      <td className="td"><p className="font-semibold text-slate-900">{f.student?.name}</p><p className="text-xs text-slate-400">{f.student?.parent?.name} · {f.student?.parent?.phone}</p></td>
                      <td className="td">{f.batch?.name} <span className="text-slate-400">· {f.batch?.subject}</span></td>
                      <td className="td">{f.month}</td>
                      <td className="td font-semibold">{money(f.amount)}</td>
                      <td className="td">{fmtDate(f.dueDate)}</td>
                      <td className="td">
                        <Badge value={f.status} />
                        {f.status === 'paid' && <p className="mt-1 text-xs text-slate-400">{fmtDate(f.paymentDate)} · {f.paymentMethod?.toUpperCase()}</p>}
                      </td>
                      <td className="td text-right">
                        {f.status !== 'paid' ? (
                          <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { setPaying(f); setPayForm({ paymentDate: todayISO(), paymentMethod: 'cash', reference: '' }); }}>Record payment</button>
                        ) : (
                          <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => reopen(f)}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {data.items.map((f) => (
                <li key={f._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="font-semibold text-slate-900">{f.student?.name}</p><p className="text-xs text-slate-500">{f.batch?.name} · {f.month}</p></div>
                    <Badge value={f.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold">{money(f.amount)} <span className="text-xs font-normal text-slate-400">due {fmtDate(f.dueDate)}</span></span>
                    {f.status !== 'paid'
                      ? <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { setPaying(f); setPayForm({ paymentDate: todayISO(), paymentMethod: 'cash', reference: '' }); }}>Record</button>
                      : <button className="btn-ghost px-2 py-1 text-xs" onClick={() => reopen(f)}>Undo</button>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <button className="btn-secondary px-3 py-1.5" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
            <span className="text-slate-500">Page {data.page} of {data.pages}</span>
            <button className="btn-secondary px-3 py-1.5" disabled={filters.page >= data.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
          </div>
        )}
      </Card>

      {/* Payment modal */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record payment"
        footer={<><button className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button><button className="btn-primary" form="pay-form" disabled={busy}><Receipt className="h-4 w-4" /> Confirm payment</button></>}>
        {paying && (
          <form id="pay-form" onSubmit={submitPayment} className="grid gap-4">
            <div className="rounded-xl bg-brand-50 p-4 text-sm">
              <p className="font-semibold text-brand-900">{paying.student?.name} · {paying.batch?.name}</p>
              <p className="text-brand-700">{paying.month} · Amount {money(paying.amount)} · Due {fmtDate(paying.dueDate)}</p>
            </div>
            <Field label="Payment date"><input type="date" className="input" required value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></Field>
            <Field label="Payment method">
              <div className="grid grid-cols-5 gap-2">
                {METHODS.map((m) => (
                  <button type="button" key={m} onClick={() => setPayForm({ ...payForm, paymentMethod: m })}
                    className={`rounded-xl py-2 text-xs font-semibold uppercase ring-1 ${payForm.paymentMethod === m ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200'}`}>{m}</button>
                ))}
              </div>
            </Field>
            <Field label="Transaction / reference (optional)"><input className="input" placeholder="UPI ref, cheque no., receipt no." value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
    </>
  );
}
