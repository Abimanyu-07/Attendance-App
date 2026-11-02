import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Phone, Mail, Users, BookOpen } from 'lucide-react';
import { api } from '../../api.js';
import { PageHeader, Card, Badge, Modal, Field, Loading, EmptyState, Alert } from '../../components/ui.jsx';

const TABS = [
  { key: 'parents', label: 'Parents' },
  { key: 'teachers', label: 'Teachers' },
];

export default function People() {
  const [tab, setTab] = useState('parents');
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null); // { type, data }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const endpoint = tab === 'parents' ? '/parents' : '/teachers';

  const load = useCallback(() => {
    setRows(null);
    api.get(endpoint, { params: { search, limit: 100 } })
      .then(({ data }) => setRows(data.items || data))
      .catch((e) => setError(e.message));
  }, [endpoint, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setError('');
    setForm(
      tab === 'parents'
        ? { id: null, data: { name: '', phone: '', email: '', password: '' } }
        : { id: null, data: { name: '', phone: '', email: '', subjects: '', password: '', active: true } }
    );
  };
  const openEdit = (r) => {
    setError('');
    setForm({
      id: r._id,
      data:
        tab === 'parents'
          ? { name: r.name, phone: r.phone, email: r.email || '', password: '', active: r.active }
          : { name: r.name, phone: r.phone, email: r.email || '', subjects: (r.subjects || []).join(', '), password: '', active: r.active },
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = { ...form.data };
    if (tab === 'teachers') body.subjects = body.subjects.split(',').map((s) => s.trim()).filter(Boolean);
    if (!body.password) delete body.password;
    try {
      if (form.id) await api.put(`${endpoint}/${form.id}`, body);
      else await api.post(endpoint, body);
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));
  const isParent = tab === 'parents';

  return (
    <>
      <PageHeader
        title="Parents & Teachers"
        subtitle="Manage guardians and staff, and their login access"
        actions={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add {isParent ? 'parent' : 'teacher'}</button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input className="input sm:max-w-xs" placeholder={`Search ${tab}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && !form && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Card><EmptyState title={`No ${tab} found`} hint="Add one using the button above." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r._id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white">
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-400">{isParent ? r.parentId : r.teacherId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={r.active ? 'active' : 'inactive'} />
                  <button className="btn-ghost px-2 py-1" onClick={() => openEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{r.phone}</p>
                {r.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{r.email}</p>}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                {isParent ? (
                  <>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" /> Linked children</p>
                    {r.children?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.children.map((c) => <span key={c._id} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{c.name}</span>)}
                      </div>
                    ) : <p className="text-xs text-slate-400">No children linked yet</p>}
                  </>
                ) : (
                  <>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><BookOpen className="h-3.5 w-3.5" /> Subjects & batches</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(r.subjects || []).map((s) => <span key={s} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{s}</span>)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.batches?.length ? r.batches.map((b) => <span key={b._id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{b.name} · {b.subject}</span>) : <p className="text-xs text-slate-400">No batches assigned</p>}
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={`${form?.id ? 'Edit' : 'Add'} ${isParent ? 'parent' : 'teacher'}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn-primary" form="people-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {form && (
          <form id="people-form" onSubmit={save} className="grid gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Full name"><input className="input" required value={form.data.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="WhatsApp / login phone"><input className="input" inputMode="tel" required value={form.data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" /></Field>
            <Field label="Email (optional)"><input type="email" className="input" value={form.data.email} onChange={(e) => set('email', e.target.value)} /></Field>
            {!isParent && (
              <Field label="Subjects"><input className="input" value={form.data.subjects} onChange={(e) => set('subjects', e.target.value)} placeholder="Mathematics, Physics" /></Field>
            )}
            <Field label={form.id ? 'New password (leave blank to keep)' : 'Login password'}>
              <input type="password" className="input" value={form.data.password} onChange={(e) => set('password', e.target.value)} placeholder={form.id ? '••••••' : 'Min 6 characters (default if blank)'} />
            </Field>
            {form.id && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.data.active} onChange={(e) => set('active', e.target.checked)} />
                Active (can log in)
              </label>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
