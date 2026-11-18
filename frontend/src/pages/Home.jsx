import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarRange, ChartColumn, Check, Dumbbell, Scale, Timer, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';

const FEATURES = [
  { icon: Timer, title: 'Fast live logging', text: 'Prefilled sets, last-time hints, one-tap check-off and an automatic rest timer.' },
  { icon: Trophy, title: 'PR detection', text: 'Volume and estimated 1RM records, flagged as soon as you finish.' },
  { icon: CalendarRange, title: '5/3/1 programming', text: 'Training maxes, weekly waves, AMRAP sets and progression built in.' },
  { icon: ChartColumn, title: 'Strength analytics', text: 'Wilks score, population standards and lift-by-lift progression.' },
  { icon: Scale, title: 'Balance checks', text: 'Spot strength imbalances between lifts before they become injuries.' },
  { icon: Dumbbell, title: 'Plate calculator', text: 'Knows your plates and rounds program weights you can actually load.' },
];

function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="pt-safe mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 text-white shadow-glow">
            <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-bold tracking-tight text-gray-900">Fitness Tracker</span>
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" to="/login">Sign in</Button>
          <Button to="/register" className="hidden sm:inline-flex">Get started</Button>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 text-center sm:px-8 sm:pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 mx-auto h-72 max-w-3xl rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative">
          <span className="chip mb-6 !bg-primary-50 !text-primary-700">
            <Check className="h-3.5 w-3.5" /> Free and open source
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-6xl">
            Your training log,{' '}
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">without the friction.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-gray-500 sm:text-lg">
            Log workouts in seconds, run proven programs, and see exactly how your strength is moving.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" to="/register">
              Create free account <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" to="/login">I already have an account</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-gray-200/80 bg-surface p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-1.5 text-sm text-gray-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="pb-safe border-t border-gray-200/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-sm text-gray-500 sm:flex-row sm:px-8">
          <p>
            Built by{' '}
            <a href="https://github.com/AndreyRainchik" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900">
              Andrey Rainchik
            </a>
          </p>
          <a href="https://github.com/AndreyRainchik/fitness-app" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 hover:text-gray-900">
            View on GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}

export default Home;
