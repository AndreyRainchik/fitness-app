import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Plus, Route } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  Alert, Button, Card, CardHeader, EmptyState, LoadingState, PageHeader, useConfirm, useToast,
} from '../components/ui';
import PlanWeeks, { PaceTable } from '../components/Run/PlanWeeks';
import { runPlansAPI } from '../services/api';
import { getLocalDateString } from '../utils/dateUtils';
import { formatDate } from '../utils/format';
import { PHASE_LABELS, formatPlanDistance } from '../utils/runPlan';

function RunPlan() {
  const confirm = useConfirm();
  const toast = useToast();
  const today = getLocalDateString();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    runPlansAPI.active().then(setData).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  const stop = async () => {
    if (!(await confirm({
      title: 'Stop this plan?',
      message: 'Planned runs from today on are removed. Runs you have done stay in your history.',
      confirmLabel: 'Stop plan',
      tone: 'danger',
    }))) return;
    try {
      await runPlansAPI.stop();
      toast({ tone: 'success', message: 'Plan stopped' });
      load();
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't stop the plan: ${err.message}` });
    }
  };

  if (error) {
    return <Layout><div className="mx-auto max-w-3xl"><Alert tone="error">Couldn&apos;t load your plan: {error}</Alert></div></Layout>;
  }
  if (!data) {
    return <Layout><div className="mx-auto max-w-3xl"><LoadingState label="Loading your plan..." /></div></Layout>;
  }

  if (!data.plan) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl">
          <PageHeader title="Run plan" />
          <EmptyState
            icon={Route}
            title="No run plan yet"
            description="Get a plan for a 5K, 10K, half or marathon, or a maintenance plan between races. Sessions are placed around your lifting days and paced from your recent running."
            action={<Button to="/plan/new" icon={Plus}>Create a plan</Button>}
          />
        </div>
      </Layout>
    );
  }

  const { plan, zones, weeks } = data;
  const unit = plan.unit;
  const thisWeek = weeks.find((w) => w.week_start <= today && today < addDays(w.week_start, 7));
  const daysToRace = plan.race ? Math.round((Date.parse(plan.race.date) - Date.parse(today)) / 86400000) : null;
  const title = plan.race ? (plan.race.name || `${plan.race.label} plan`) : 'Maintenance plan';
  const total = weeks.reduce((sum, w) => sum + w.total_m, 0);

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Run plan"
          title={title}
          subtitle={plan.race
            ? `${plan.race.label} on ${formatDate(plan.race.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
            : `Until ${formatDate(plan.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          actions={(
            <>
              <Button variant="secondary" to="/plan/new" icon={Plus}>New plan</Button>
              <Button variant="danger-subtle" onClick={stop}>Stop plan</Button>
            </>
          )}
        />

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {daysToRace != null && daysToRace >= 0 && (
            <Card padding="p-4"><p className="text-sm text-gray-500">Race day</p><p className="text-2xl font-bold text-gray-900">{daysToRace === 0 ? 'Today' : `${daysToRace} days`}</p></Card>
          )}
          <Card padding="p-4">
            <p className="text-sm text-gray-500">This week</p>
            <p className="text-2xl font-bold text-gray-900">{thisWeek ? (PHASE_LABELS[thisWeek.phase] ?? thisWeek.phase) : '–'}</p>
            {thisWeek && <p className="text-xs text-gray-500">Week {thisWeek.index + 1} of {weeks.length}{thisWeek.cutback ? ' · easier week' : ''}</p>}
          </Card>
          <Card padding="p-4"><p className="text-sm text-gray-500">This week&apos;s running</p><p className="text-2xl font-bold text-gray-900">{thisWeek ? formatPlanDistance(thisWeek.total_m, unit) : '–'}</p></Card>
          <Card padding="p-4"><p className="text-sm text-gray-500">Whole plan</p><p className="text-2xl font-bold text-gray-900">{formatPlanDistance(total, unit, 0)}</p></Card>
        </div>

        {plan.warnings.length > 0 && (
          <Alert tone="warning" className="mb-4" title="Things to know">
            <ul className="list-disc space-y-1 pl-4">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <PlanWeeks weeks={weeks} zones={zones} unit={unit} today={today} />
          </div>
          <div className="space-y-4">
            <Card padding="p-4">
              <CardHeader title="Your paces" icon={Flag} subtitle={plan.vdot_source} />
              <PaceTable zones={zones} unit={unit} zoneInfo={data.zone_info} />
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export default RunPlan;
