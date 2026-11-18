import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChartColumn, Dumbbell, Timer, Trophy } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Timer, title: 'Log fast', text: 'Sets prefill from last time, rest timer starts itself.' },
  { icon: Trophy, title: 'Catch every PR', text: 'Volume and estimated 1RM records, flagged automatically.' },
  { icon: CalendarRange, title: 'Run real programs', text: '5/3/1 with weekly progression and AMRAP tracking.' },
  { icon: ChartColumn, title: 'See the big picture', text: 'Strength scores, balance checks and muscle maps.' },
];

/** Split-screen frame for sign in / sign up. */
function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-purple-700 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-purple-400/30 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">Fitness Tracker</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Train with intent.<br />Track every rep.</h2>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-white/75">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-safe pb-safe flex flex-1 flex-col items-center justify-start px-5 py-8 sm:justify-center sm:px-8 sm:py-10">
        <div className="w-full max-w-sm animate-fade-in">
          <Link to="/" className="mb-8 flex items-center gap-2.5 sm:mb-10 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 text-white shadow-glow">
              <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900">Fitness Tracker</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-gray-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
