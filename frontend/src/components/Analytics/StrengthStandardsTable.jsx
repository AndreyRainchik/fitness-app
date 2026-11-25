import React from 'react';
import { Badge, Card, CardHeader } from '../ui';
import { formatNumber } from '../../utils/format';
import StrengthScoreCard, { LevelProgressBar } from './StrengthScoreCard';
import { LEVEL_TONES } from '../../utils/analytics';

const LIFTS = [
  { key: 'squat', name: 'Squat' },
  { key: 'bench', name: 'Bench press' },
  { key: 'deadlift', name: 'Deadlift' },
  { key: 'ohp', name: 'Overhead press' },
];

const HEADER = 'px-4 py-3 text-left lg:px-6 text-xs font-medium uppercase tracking-wider text-gray-500';

/**
 * Analytics > Standards: each main lift's estimated 1RM against population
 * standards, its percentile, and progress to the next level. A table on
 * wide screens, one card per lift on phones. Weights are in `units`.
 */
function StrengthStandardsTable({ strengthData, units = 'lbs' }) {
  if (!strengthData) {
    return (
      <Card>
        <CardHeader title="Strength standards" />
        <p className="py-8 text-center text-gray-500">No strength data available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="p-0" className="overflow-hidden">
        <div className="p-4 md:border-b md:border-gray-200 md:p-6">
          <h3 className="text-xl font-bold text-gray-900 md:text-2xl">Strength standards</h3>
          <p className="mt-1 text-sm text-gray-600">Your best lifts in this range compared with population standards</p>
        </div>

        {/* Wide screens: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={HEADER}>Lift</th>
                <th className={HEADER}>Est. 1RM</th>
                <th className={HEADER}>Standard</th>
                <th className={`${HEADER} w-full`}>Progress to next level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-surface">
              {LIFTS.map((lift) => {
                const data = strengthData[lift.key];
                if (!data || data.estimated1RM === 0) {
                  return (
                    <tr key={lift.key}>
                      <td className="whitespace-nowrap px-4 py-4 lg:px-6 text-sm font-medium text-gray-900">{lift.name}</td>
                      <td colSpan="3" className="px-4 py-4 lg:px-6 text-sm text-gray-500">No data in this range</td>
                    </tr>
                  );
                }
                return (
                  <tr key={lift.key} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4 lg:px-6 text-sm font-medium text-gray-900">{lift.name}</td>
                    <td className="tabular whitespace-nowrap px-4 py-4 lg:px-6 text-sm font-bold text-gray-900">
                      {formatNumber(data.estimated1RM, 1)} <span className="font-medium text-gray-500">{units}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 lg:px-6">
                      <Badge tone={LEVEL_TONES[data.standard] ?? 'neutral'}>{data.standard}</Badge>
                      <p className="tabular mt-1 text-xs text-gray-500">{data.percentile}th percentile</p>
                    </td>
                    <td className="px-4 py-4 lg:px-6">
                      <div className="min-w-[12rem]">
                        <LevelProgressBar lift={data} units={units} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {strengthData.total > 0 && (
          <div className="hidden items-center justify-between border-t border-gray-200 bg-gray-50 p-4 md:flex md:p-6">
            <span className="text-sm font-medium text-gray-700">Powerlifting total</span>
            <span className="tabular whitespace-nowrap text-xl font-bold text-primary-600 md:text-2xl">
              {formatNumber(strengthData.total, 1)} {units}
            </span>
          </div>
        )}
      </Card>

      {/* Phones: one card per lift */}
      <div className="grid gap-3 md:hidden">
        {LIFTS.map((lift) => (
          <StrengthScoreCard key={lift.key} title={lift.name} lift={strengthData[lift.key]} units={units} />
        ))}
        {strengthData.total > 0 && (
          <Card padding="p-4" className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Powerlifting total</span>
            <span className="tabular whitespace-nowrap text-xl font-bold text-primary-600">
              {formatNumber(strengthData.total, 1)} {units}
            </span>
          </Card>
        )}
      </div>
    </div>
  );
}

export default StrengthStandardsTable;
