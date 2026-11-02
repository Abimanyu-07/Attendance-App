import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserSquare2, GraduationCap, Layers, Wallet, BarChart3,
  CalendarCheck, Menu, LogOut, School, Baby,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/people', label: 'Parents & Teachers', icon: UserSquare2 },
    { to: '/admin/batches', label: 'Classes & Batches', icon: Layers },
    { to: '/admin/fees', label: 'Fees', icon: Wallet },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ],
  teacher: [{ to: '/teacher', label: 'My Batches', icon: CalendarCheck, end: true }],
  parent: [{ to: '/parent', label: 'My Children', icon: Baby, end: true }],
};

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', parent: 'Parent' };

function NavItems({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const SidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pb-6 pt-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 shadow-lg shadow-brand-900/40">
          <School className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Smart Tuition</p>
          <p className="text-xs text-slate-400">Attendance & Fees</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavItems items={items} onNavigate={() => setOpen(false)} />
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="mb-3 px-3">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-gradient-to-b from-slate-900 to-slate-950 p-4 lg:block">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-2xl">
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-700 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold text-slate-900">Smart Tuition Centre</p>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {user.name?.[0]?.toUpperCase()}
        </div>
      </header>

      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
