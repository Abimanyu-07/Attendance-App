import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, UserX, UserCheck, Eye } from 'lucide-react';
import { api, fmtDate, money, todayISO } from '../../api.js';
import { PageHeader, Card, Badge, Modal, Field, Loading, EmptyState, Alert } from '../../components/ui.jsx';

const EMPTY = { name: '', grade: '', batches: [], parent: '', admissionDate: todayISO(), status: 'active' };

export default function Students() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', grade: '', batch: '', status: '', page: 1 });
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    api.get('/students', { params: { ...params, limit: 15 } })
      .then(({ data }) => {
        setRows(data.items);
        setMeta({ page: data.page, pages: data.pages, total: data.total });
      })
      .catch((e) => setError(e.message));
  }, [filters]);

  useEffect(load, [load]);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/batches', { params: { active: 'true' } }), api.get('/parents', { params: { limit: 200 } })])
      .then(([c, b, p]) => {
        setClasses(c.data);
        setBatches(b.data);
        setParents(p.data.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  // debounce the search box
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchText, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
    setError('');
  };
  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({
      name: s.name,
      grade: s.grade?._id || '',
      batches: s.batches.map((b) => b._id),
      parent: s.parent?._id || '',
      admissionDate: s.admissionDate,
      status: s.status,
    });
    setError('');
  };

  const toggleBatch = (id) =>
    setForm((f) => ({ ...f, batches: f.batches.includes(id) ? f.batches.filter((b) => b !== id) : [...f.batches, id] }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) await api.put(`/students/${editingId}`, form);
      else await api.post('/students', form);
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (s) => {
    const action = s.status === 'active' ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${s.name}?`)) return;
    try {
      if (action === 'deactivate') await api.delete(`/students/${s._id}`);
      else await api.post(`/students/${s._id}/reactivate`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openView = async (s) => {
    const { data } = await api.get(`/students/${s._id}`);
    setViewing(data);
  };

  const filteredBatches = batches.filter((b) => !form?.grade || String(b.classRef?._id || b.classRef) === form.grade);
  const attendancePct = (summary = []) => {
    const total = summary.reduce((a, s) => a + s.count, 0);
    const att = summary.filter((s) => s._id !== 'absent').reduce((a, s) => a + s.count, 0);
    return total ? Math.round((att / total) * 100) : null;
  };

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${meta.total} student record(s)`}
        actions={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add student</button>}
      />

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search by name or student ID…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <select className="input" value={filters.grade} onChange={(e) => setFilters({ ...filters, grade: e.target.value, batch: '', page: 1 })}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className="input" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value, page: 1 })}>
            <option value="">All batches</option>
            {batches.filter((b) => !filters.grade || String(b.classRef?._id) === filters.grade).map((b) => (
              <option key={b._id} value={b._id}>{b.classRef?.name} · {b.name} ({b.subject})</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          {['', 'active', 'inactive'].map((s) => (
            <button key={s || 'all'} onClick={() => setFilters({ ...filters, status: s, page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filters.status === s ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
              {s ? (s === 'active' ? 'Active' : 'Inactive') : 'All'}
            </button>
          ))}
        </div>
      </Card>

      {error && !form && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card className="overflow-hidden">
        {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="No students found" hint="Try clearing the filters or add a new student." /> : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="th">Student</th><th className="th">Class</th><th className="th">Batches</th>
                    <th className="th">Parent</th><th className="th">Status</th><th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.studentId}</p>
                      </td>
                      <td className="td">{s.grade?.name}</td>
                      <td className="td">{s.batches.map((b) => b.name).join(', ') || <span className="text-slate-400">None</span>}</td>
                      <td className="td">
                        <p>{s.parent?.name}</p>
                        <p className="text-xs text-slate-400">{s.parent?.phone}</p>
                      </td>
                      <td className="td"><Badge value={s.status} /></td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button className="btn-ghost px-2.5 py-1.5" onClick={() => openView(s)} title="View"><Eye className="h-4 w-4" /></button>
                          <button className="btn-ghost px-2.5 py-1.5" onClick={() => openEdit(s)} title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button className="btn-ghost px-2.5 py-1.5" onClick={() => toggleStatus(s)} title={s.status === 'active' ? 'Deactivate' : 'Reactivate'}>
                            {s.status === 'active' ? <UserX className="h-4 w-4 text-rose-500" /> : <UserCheck className="h-4 w-4 text-emerald-600" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((s) => (
                <li key={s._id} className="p-4" onClick={() => openView(s)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.studentId} · {s.grade?.name}</p>
                    </div>
                    <Badge value={s.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Parent: {s.parent?.name} · {s.parent?.phone}</p>
                  <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => toggleStatus(s)}>{s.status === 'active' ? 'Deactivate' : 'Reactivate'}</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <button className="btn-secondary px-3 py-1.5" disabled={meta.page <= 1} onClick={() => setFilters({ ...filters, page: meta.page - 1 })}>Previous</button>
            <span className="text-slate-500">Page {meta.page} of {meta.pages}</span>
            <button className="btn-secondary px-3 py-1.5" disabled={meta.page >= meta.pages} onClick={() => setFilters({ ...filters, page: meta.page + 1 })}>Next</button>
          </div>
        )}
      </Card>

      {/* Add / edit modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editingId ? 'Edit student' : 'Add student'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn-primary" form="student-form" disabled={saving}>{saving ? 'Saving…' : 'Save student'}</button>
          </>
        }
      >
        {form && (
          <form id="student-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
            <Field label="Full name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Admission date"><input type="date" className="input" required value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></Field>
            <Field label="Class / grade">
              <select className="input" required value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, batches: [] })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Parent / guardian">
              <select className="input" required value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
                <option value="">Select parent</option>
                {parents.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.phone}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">Not listed? Add the parent under Parents &amp; Teachers first.</p>
            </Field>
            <Field label="Batches">
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {!form.grade && <p className="px-1 py-2 text-xs text-slate-400">Select a class to see its batches.</p>}
                {form.grade && filteredBatches.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">No batches for this class yet.</p>}
                {filteredBatches.map((b) => (
                  <label key={b._id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.batches.includes(b._id)} onChange={() => toggleBatch(b._id)} />
                    <span className="text-sm">{b.name} · {b.subject} <span className="text-slate-400">({money(b.monthlyFee)}/mo)</span></span>
                  </label>
                ))}
              </div>
            </Field>
          </form>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name || ''} wide>
        {viewing && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Student ID" value={viewing.studentId} />
              <Info label="Status" value={<Badge value={viewing.status} />} />
              <Info label="Class" value={viewing.grade?.name} />
              <Info label="Admitted" value={fmtDate(viewing.admissionDate)} />
              <Info label="Parent" value={`${viewing.parent?.name} (${viewing.parent?.phone})`} />
              <Info label="Attendance" value={attendancePct(viewing.attendanceSummary) === null ? 'No records yet' : `${attendancePct(viewing.attendanceSummary)}%`} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Batches</h3>
              {viewing.batches.length === 0 ? <p className="text-sm text-slate-400">Not assigned to any batch.</p> : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {viewing.batches.map((b) => (
                    <li key={b._id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">{b.name} · {b.subject}</p>
                      <p className="text-xs text-slate-500">{b.days.join(', ')} · {b.startTime}–{b.endTime} · {b.room || 'Room TBA'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Fee history</h3>
              {viewing.fees.length === 0 ? <p className="text-sm text-slate-400">No fee records yet.</p> : (
                <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr><th className="th">Month</th><th className="th">Batch</th><th className="th">Amount</th><th className="th">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewing.fees.map((f) => (
                        <tr key={f._id}><td className="td">{f.month}</td><td className="td">{f.batch?.name}</td><td className="td">{money(f.amount)}</td><td className="td"><Badge value={f.status} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value || '—'}</div>
    </div>
  );
}
