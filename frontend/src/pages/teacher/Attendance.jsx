import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Save, Search, CheckCheck } from 'lucide-react';
import { api, todayISO, fmtDate } from '../../api.js';
import { Loading, Alert, Spinner } from '../../components/ui.jsx';

const STATUSES = [
  { key: 'present', label: 'P', name: 'Present', on: 'bg-emerald-600 text-white', off: 'text-emerald-700 bg-emerald-50' },
  { key: 'late', label: 'L', name: 'Late', on: 'bg-amber-500 text-white', off: 'text-amber-700 bg-amber-50' },
  { key: 'absent', label: 'A', name: 'Absent', on: 'bg-rose-600 text-white', off: 'text-rose-700 bg-rose-50' },
];

export default function TeacherAttendance() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRoster(null);
    setResult(null);
    api
      .get(`/attendance/batch/${batchId}`, { params: { date } })
      .then(({ data }) => {
        setRoster(data);
        setStatuses(Object.fromEntries(data.students.map((s) => [s._id, s.status])));
      })
      .catch((e) => setError(e.message));
  }, [batchId, date]);

  const students = useMemo(
    () => (roster?.students || []).filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.studentId.toLowerCase().includes(query.toLowerCase())),
    [roster, query]
  );

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    Object.values(statuses).forEach((s) => (c[s] = (c[s] || 0) + 1));
    return c;
  }, [statuses]);

  const setOne = (id, status) => setStatuses((prev) => ({ ...prev, [id]: status }));
  const markAllPresent = () => setStatuses(Object.fromEntries((roster?.students || []).map((s) => [s._id, 'present'])));

  const save = async () => {
    setSaving(true);
    setError('');
    setResult(null);
    try {
      const records = Object.entries(statuses).map(([student, status]) => ({ student, status }));
      const { data } = await api.post(`/attendance/batch/${batchId}`, { date, records });
      setResult(data);
      setRoster((r) => ({ ...r, marked: true }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !roster) return <Alert>{error}</Alert>;
  if (!roster) return <Loading />;

  return (
    <div className="-mx-4 -mt-5 min-h-[calc(100vh-4rem)] bg-slate-50 pb-28 lg:-mx-8 lg:-mt-8 lg:mx-auto lg:max-w-2xl lg:pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 pb-4 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher')} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-brand-600">{roster.batch.className} · {roster.batch.subject}</p>
            <h1 className="truncate text-lg font-bold text-slate-900">{roster.batch.name} · {roster.batch.startTime}–{roster.batch.endTime}</h1>
          </div>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="input w-auto px-2.5 py-2 text-xs" aria-label="Attendance date" />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input py-2 pl-9" placeholder="Find student…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button onClick={markAllPresent} className="btn-secondary shrink-0 px-3 py-2 text-xs"><CheckCheck className="h-4 w-4" /> All present</button>
        </div>

        <div className="mt-3 flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Present {counts.present}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Late {counts.late}</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Absent {counts.absent}</span>
          <span className="ml-auto self-center text-slate-400">{fmtDate(date)}</span>
        </div>
      </div>

      {roster.marked && !result && (
        <div className="mx-4 mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-sky-200">
          Attendance is already saved for this date. Changes you make will update it.
        </div>
      )}
      {result && (
        <div className="mx-4 mt-4 space-y-1 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" /> Attendance saved</p>
          <p>{result.absent > 0 ? `${result.parentsNotified} parent(s) notified about absences via WhatsApp.` : 'Everyone is accounted for. No absence alerts sent.'}</p>
        </div>
      )}
      {error && roster && <div className="mx-4 mt-4"><Alert>{error}</Alert></div>}

      {/* Roster */}
      <ul className="mt-4 space-y-2 px-4">
        {students.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No students match “{query}”.</li>}
        {students.map((s) => {
          const current = statuses[s._id] || 'present';
          return (
            <li key={s._id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-400">{s.studentId}</p>
              </div>
              <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                {STATUSES.map((st) => (
                  <button
                    key={st.key}
                    role="radio"
                    aria-checked={current === st.key}
                    onClick={() => setOne(s._id, st.key)}
                    title={st.name}
                    className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold transition active:scale-95 ${current === st.key ? st.on + ' shadow-md' : st.off}`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="hidden text-xs text-slate-500 sm:block">Absent students' parents get a WhatsApp alert when you save.</p>
          <button onClick={save} disabled={saving || !roster.students.length} className="btn-primary ml-auto w-full py-3 sm:w-auto sm:min-w-[200px]">
            {saving ? <Spinner className="h-4 w-4 text-white" /> : <><Save className="h-4 w-4" /> Save attendance</>}
          </button>
        </div>
      </div>
    </div>
  );
}
