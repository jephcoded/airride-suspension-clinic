import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X, ScrollText, Settings, Images } from 'lucide-react';
import { useLogout, useMe, type Role } from '../../lib/auth';
import { Logo } from '../../components/ui/misc';
import { useSeo } from '../../lib/useSeo';

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; roles?: Role[]; end?: boolean }[] = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/jobs', label: 'Repair Jobs', icon: ClipboardList },
  { to: '/staff/enquiries', label: 'Enquiries', icon: Inbox, roles: ['ADMIN', 'ADVISOR'] },
  { to: '/staff/warranty', label: 'Warranty Claims', icon: ShieldCheck, roles: ['ADMIN', 'ADVISOR'] },
  { to: '/staff/users', label: 'Staff Accounts', icon: Users, roles: ['ADMIN'] },
  { to: '/staff/photos', label: 'Website Photos', icon: Images, roles: ['ADMIN'] },
  { to: '/staff/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
  { to: '/staff/audit', label: 'Audit Log', icon: ScrollText, roles: ['ADMIN'] },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin / Manager', ADVISOR: 'Service Advisor', TECHNICIAN: 'Technician' };

export default function StaffLayout() {
  useSeo();
  const { data: me } = useMe();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = NAV.filter((n) => !n.roles || (me && n.roles.includes(me.role)));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Logo light /></div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-500 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white')}
          >
            <n.icon className="size-5" /> {n.label}
          </NavLink>
        ))}
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-300 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-5" /> View website
        </a>
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">{me?.name}</p>
        <p className="text-xs text-navy-300">{me && ROLE_LABEL[me.role]}</p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-navy-300 hover:text-white"><LogOut className="size-4" /> Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-navy-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-navy-950 lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={clsx('fixed inset-y-0 left-0 z-50 w-72 bg-navy-950 transition-transform lg:hidden', open ? 'translate-x-0' : '-translate-x-full')}>
        <button onClick={() => setOpen(false)} className="absolute top-4 right-3 p-1 text-navy-300" aria-label="Close menu"><X className="size-6" /></button>
        {sidebar}
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-navy-100 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="p-1" aria-label="Open menu"><Menu className="size-6" /></button>
          <span className="font-display font-bold">Airride Workshop</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
