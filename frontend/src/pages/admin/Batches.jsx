import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Clock, MapPin, Users } from 'lucide-react';
import { api, money } from '../../api.js';
import { PageHeader, Card, Badge, Modal, Field, Loading, EmptyState, Alert } from '../../components/ui.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_BATCH = { name: '', classRef: '', teacher: '', subject: '', days: [], startTime: '16:00', endTime: '17:30', room: '', monthlyFee: 1000, active: true };

export default function Batches() {
  const [classes, setClasses] = useState(null);
  const [batches, setBatches] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [classForm, setClassForm] = useState(null);
  const [batchForm, setBatchForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/classes').then(({ data }) => setClasses(data)).catch((e) => setError(e.message));
    api.get('/batches', { params: classFilter ? { classId: classFilter } : {} })
      .then(({ data }) => setBatches(data))
      .catch((e) => setError(e.message));
  }, [classFilter]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
  }, []);

  const run = async (fn) => {
    setSaving(true);
    setError('');
    try {
      await fn();
      setClassForm(null);
      setBatchForm(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveClass = (e) => {
    e.preventDefault();
    run(() => (classForm.id ? api.put(`/classes/${classForm.id}`, classForm.data) : api.post('/classes', classForm.data)));
  };

  const saveBatch = (e) => {
    e.preventDefault();
    const { id, data } = batchForm;
    const body = { ...data, teacher: data.teacher || null, monthlyFee: Number(data.monthlyFee) };
    run(() => (id ? api.put(`/batches/${id}`, body) : api.post('/batches', body)));
  };

  const deactivate = (b) => {
    if (!confirm(`Deactivate ${b.name} (${b.subject})? Students will keep their history.`)) return;
    run(() => api.delete(`/batches/${b.id ?? b._id}`));
  };

  const toggleDay = (d) =>
    setBatchForm((f) => ({ ...f, data: { ...f.data, days: f.data.days.includes(d) ? f.data.days.filter((x) => x !== d) : [...f.data.days, d] } }));

  return (
    <>
      <PageHeader
        title="Classes & Batches"
        subtitle="Each class can run several batches with different teachers, subjects and timings"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setClassForm({ id: null, data: { name: '', order: (classes?.length || 0) + 1 } })}>
              <Plus className="h-4 w-4" /> Class
            </button>
            <button className="btn-primary" onClick={() => setBatchForm({ id: null, data: { ...EMPTY_BATCH, classRef: classFilter || classes?.[0]?._id || '' } })}>
              <Plus className="h-4 w-4" /> Batch
            </button>
          </>
        }
      />

      {error && !batchForm && !classForm && <div className="mb-4"><Alert>{error}</Alert></div>}

      {/* Classes */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Classes</h2>
        {!classes ? <Loading /> : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button onClick={() => setClassFilter('')} className={`shrink-0 rounded-2xl px-5 py-3 text-sm font-semibold ring-1 ${!classFilter ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-200'}`}>All</button>
            {classes.map((c) => (
              <div key={c._id} className={`flex shrink-0 items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ${classFilter === c._id ? 'ring-2 ring-brand-500' : 'ring-slate-200'}`}>
                <button onClick={() => setClassFilter(c._id)} className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.students} active students</p>
                </button>
                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setClassForm({ id: c._id, data: { name: c.name, order: c.order } })} aria-label="Edit class">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Batches */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Batches</h2>
        {!batches ? <Loading /> : batches.length === 0 ? (
          <Card><EmptyState title="No batches yet" hint="Create a batch for a class and assign a teacher." /></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {batches.map((b) => (
              <Card key={b._id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-brand-600">{b.classRef?.name}</p>
                    <p className="text-lg font-bold text-slate-900">{b.name} · {b.subject}</p>
                  </div>
                  <Badge value={b.active ? 'active' : 'inactive'}>{b.active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>Teacher: <span className="font-medium text-slate-800">{b.teacher?.name || 'Unassigned'}</span></p>
                  <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-slate-400" />{b.days.join(', ') || '—'} · {b.startTime}–{b.endTime}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" />{b.room || 'Room not set'}</p>
                  <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-slate-400" />{b.students} students · {money(b.monthlyFee)}/month</p>
                </div>
                <div className="mt-auto flex gap-2 pt-5">
                  <button className="btn-secondary flex-1 py-2 text-xs" onClick={() => setBatchForm({ id: b._id, data: { name: b.name, classRef: b.classRef?._id, teacher: b.teacher?._id || '', subject: b.subject, days: b.days, startTime: b.startTime, endTime: b.endTime, room: b.room || '', monthlyFee: b.monthlyFee, active: b.active } })}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {b.active && (
                    <button className="btn-ghost py-2 text-xs text-rose-600" onClick={() => deactivate(b)}>
                      <Trash2 className="h-3.5 w-3.5" /> Deactivate
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Class modal */}
      <Modal open={!!classForm} onClose={() => setClassForm(null)} title={classForm?.id ? 'Edit class' : 'Add class'}
        footer={<><button className="btn-secondary" onClick={() => setClassForm(null)}>Cancel</button><button className="btn-primary" form="class-form" disabled={saving}>Save</button></>}>
        {classForm && (
          <form id="class-form" onSubmit={saveClass} className="grid gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Class name"><input className="input" required placeholder="e.g. 10th Standard" value={classForm.data.name} onChange={(e) => setClassForm({ ...classForm, data: { ...classForm.data, name: e.target.value } })} /></Field>
            <Field label="Display order"><input type="number" className="input" value={classForm.data.order} onChange={(e) => setClassForm({ ...classForm, data: { ...classForm.data, order: Number(e.target.value) } })} /></Field>
          </form>
        )}
      </Modal>

      {/* Batch modal */}
      <Modal open={!!batchForm} onClose={() => setBatchForm(null)} title={batchForm?.id ? 'Edit batch' : 'Add batch'} wide
        footer={<><button className="btn-secondary" onClick={() => setBatchForm(null)}>Cancel</button><button className="btn-primary" form="batch-form" disabled={saving}>{saving ? 'Saving…' : 'Save batch'}</button></>}>
        {batchForm && (
          <form id="batch-form" onSubmit={saveBatch} className="grid gap-4 sm:grid-cols-2">
            {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
            {(() => {
              const set = (k, v) => setBatchForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));
              return (
                <>
                  <Field label="Class">
                    <select className="input" required value={batchForm.data.classRef} onChange={(e) => set('classRef', e.target.value)}>
                      <option value="">Select class</option>
                      {classes?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Batch name"><input className="input" required placeholder="Batch A" value={batchForm.data.name} onChange={(e) => set('name', e.target.value)} /></Field>
                  <Field label="Subject"><input className="input" required placeholder="Mathematics" value={batchForm.data.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
                  <Field label="Teacher">
                    <select className="input" value={batchForm.data.teacher} onChange={(e) => set('teacher', e.target.value)}>
                      <option value="">Unassigned</option>
                      {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Start time"><input type="time" className="input" required value={batchForm.data.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
                  <Field label="End time"><input type="time" className="input" required value={batchForm.data.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
                  <Field label="Room / location"><input className="input" placeholder="Room 1" value={batchForm.data.room} onChange={(e) => set('room', e.target.value)} /></Field>
                  <Field label="Monthly fee (₹)"><input type="number" min="0" className="input" required value={batchForm.data.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} /></Field>
                  <div className="sm:col-span-2">
                    <label className="label">Class days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((d) => (
                        <button type="button" key={d} onClick={() => toggleDay(d)}
                          className={`h-10 w-12 rounded-xl text-sm font-semibold ring-1 transition ${batchForm.data.days.includes(d) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  {batchForm.id && (
                    <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={batchForm.data.active} onChange={(e) => set('active', e.target.checked)} />
                      Active batch
                    </label>
                  )}
                </>
              );
            })()}
          </form>
        )}
      </Modal>
    </>
  );
}
