import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, CheckCircle2, ChevronRight, CalendarDays } from 'lucide-react';
import { api, fmtDate } from '../../api.js';
import { Card, Loading, EmptyState, Alert, Badge } from '../../components/ui.jsx';
import { useAuth } from '../../auth.jsx';

export default function TeacherHome() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/batches').then(({ data }) => setData(data)).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;

  const todays = data.batches.filter((b) => b.meetsToday);
  const others = data.batches.filter((b) => !b.meetsToday);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-600">{fmtDate(data.today)}</p>
        <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">Tap a batch to mark attendance.</p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Today's classes</h2>
        {todays.length === 0 ? (
          <Card><EmptyState title="No classes scheduled today" hint="Enjoy your day off!" /></Card>
        ) : (
          <div className="space-y-3">
            {todays.map((b) => <BatchTile key={b._id} b={b} />)}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Other batches</h2>
          <div className="space-y-3">
            {others.map((b) => <BatchTile key={b._id} b={b} muted />)}
          </div>
        </section>
      )}
    </>
  );
}

function BatchTile({ b, muted }) {
  return (
    <Link to={`/teacher/batch/${b._id}`} className={`block ${muted ? 'opacity-75' : ''}`}>
      <Card className="flex items-center gap-4 p-4 transition active:scale-[0.99] hover:ring-brand-200">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-center text-xs font-bold leading-tight text-white shadow-md shadow-brand-200">
          {b.startTime}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{b.classroom} · {b.name}</p>
          <p className="truncate text-sm text-slate-600">{b.subject}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{b.startTime}–{b.endTime}</span>
            {b.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.room}</span>}
            {b.days?.length > 0 && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{b.days.join(' ')}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {b.markedToday ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Marked</span>
          ) : (
            <Badge value={muted ? 'default' : 'pending'}>{muted ? 'Not today' : 'To mark'}</Badge>
          )}
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>
      </Card>
    </Link>
  );
}
