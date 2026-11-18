import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Dumbbell, Ellipsis, LogOut, NotebookPen, Play, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkoutDraft } from '../../utils/workoutDraft';
import { NAV_ITEMS, isActivePath } from './nav';
import ThemeToggle from './ThemeToggle';

// Extra shortcuts that only appear in the phone "More" sheet
const SHEET_EXTRAS = [{ to: '/workout/new', label: 'Log past', icon: NotebookPen, exact: true }];

function Logo({ compact = false }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="Fitness Tracker home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 text-white shadow-glow">
        <Dumbbell className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {!compact && <span className="text-[15px] font-bold tracking-tight text-gray-900">Fitness Tracker</span>}
    </Link>
  );
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-sm font-semibold text-gray-700">
      {initial}
    </span>
  );
}

/** "Start" / "Resume" workout call to action. */
function StartButton({ draft, className = '' }) {
  return (
    <Link
      to="/workout/active"
      className={`flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-primary-500 active:scale-[0.98] ${className}`}
    >
      {draft ? <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
      {draft ? 'Resume workout' : 'Start workout'}
    </Link>
  );
}

function Sidebar({ user, draft, onLogout }) {
  const { pathname } = useLocation();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200/80 bg-surface/80 px-4 py-5 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <StartButton draft={draft} className="mt-6" />
      <nav className="mt-6 flex flex-1 flex-col gap-0.5" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-gray-200/80 pt-4">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-1">
          <Avatar name={user?.username} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{user?.username}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MoreSheet({ open, onClose, user, onLogout }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
      <button type="button" className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Close menu" />
      <div className="pb-safe absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-gray-200/80 bg-surface p-4 shadow-lift">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="mb-4 flex items-center gap-3 px-1">
          <Avatar name={user?.username} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900">{user?.username}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="grid grid-cols-3 gap-2" aria-label="All pages">
          {[...NAV_ITEMS, ...SHEET_EXTRAS].map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.to : isActivePath(pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium ${
                  active ? 'bg-primary-50 text-primary-700' : 'bg-gray-50 text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle className="mt-4" />
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-danger-600 hover:bg-danger-50"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function BottomNav({ draft, onMore }) {
  const { pathname } = useLocation();
  const mobileItems = NAV_ITEMS.filter((i) => i.mobile);
  const tab = (item) => {
    const Icon = item.icon;
    const active = isActivePath(pathname, item);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${active ? 'text-primary-600' : 'text-gray-500'}`}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        {item.label}
      </NavLink>
    );
  };
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-surface/85 backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-end px-2">
        {tab(mobileItems[0])}
        {tab(mobileItems[1])}
        <div className="flex flex-1 justify-center">
          <Link
            to="/workout/active"
            className={`-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow transition-transform active:scale-95 ${
              draft ? 'bg-success-600' : 'bg-primary-600'
            }`}
            aria-label={draft ? 'Resume workout' : 'Start workout'}
          >
            {draft ? <Play className="h-6 w-6" fill="currentColor" /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
          </Link>
        </div>
        {tab(mobileItems[2])}
        <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-gray-500">
          <Ellipsis className="h-[22px] w-[22px]" aria-hidden="true" />
          More
        </button>
      </div>
    </nav>
  );
}

/** Banner reminding the user an unfinished workout is saved. */
function DraftBanner({ draft }) {
  const exercises = draft.values?.exercises?.length ?? 0;
  return (
    <Link
      to="/workout/active"
      className="mb-6 flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 p-3 pr-4 text-success-800 transition-colors hover:bg-success-100"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-success-600 text-white">
        <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-success-400 ring-2 ring-success-50" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Workout in progress</span>
        <span className="block truncate text-xs opacity-80">
          {draft.values?.name || 'Untitled workout'} · {exercises} exercise{exercises === 1 ? '' : 's'}
        </span>
      </span>
      <span className="text-sm font-semibold">Resume</span>
    </Link>
  );
}

/**
 * App shell for signed-in pages: sidebar on desktop, top bar + bottom tab
 * bar on phones. `focus` hides the navigation chrome (Active Workout).
 */
function Layout({ children, focus = false, width = 'max-w-6xl' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const draft = useWorkoutDraft();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const handleLogout = () => {
    setMoreOpen(false);
    logout();
    navigate('/login');
  };

  // The dashboard has its own resume card
  const showDraftBanner = draft && !pathname.startsWith('/workout/active') && pathname !== '/dashboard';

  return (
    <div className="min-h-screen bg-canvas">
      {!focus && <Sidebar user={user} draft={draft} onLogout={handleLogout} />}

      {!focus && (
        <header className="pt-safe sticky top-0 z-30 border-b border-gray-200/80 bg-canvas/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo />
            <Link to="/profile" aria-label="Profile">
              <Avatar name={user?.username} />
            </Link>
          </div>
        </header>
      )}

      <main className={focus ? '' : 'lg:pl-64'}>
        <div className={`mx-auto ${width} px-3 pt-6 min-[360px]:px-4 sm:px-6 lg:px-8 lg:pt-10 ${focus ? 'pb-40' : 'pb-safe-nav lg:pb-10'}`}>
          {showDraftBanner && <DraftBanner draft={draft} />}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>

      {!focus && <BottomNav draft={draft} onMore={() => setMoreOpen(true)} />}
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} onLogout={handleLogout} />
    </div>
  );
}

export default Layout;
