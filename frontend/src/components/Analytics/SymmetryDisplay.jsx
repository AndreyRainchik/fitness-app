import React from 'react';

/**
 * SymmetryDisplay
 * 
 * Displays balance/symmetry analysis showing:
 * - Overall symmetry score
 * - Lift ratios with ideal ranges
 * - Detected imbalances with recommendations
 */
function SymmetryDisplay({ symmetryData }) {
  if (!symmetryData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Symmetry Analysis</h3>
        <div className="text-center text-gray-500 py-8">
          <p>No symmetry data available</p>
        </div>
      </div>
    );
  }

  const { ratios, lifts, imbalances, overallScore, interpretation } = symmetryData;

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 85) return 'bg-green-50';
    if (score >= 70) return 'bg-blue-50';
    if (score >= 50) return 'bg-orange-50';
    return 'bg-red-50';
  };

  // Ratio display component
  const RatioCard = ({ title, actual, ideal, description }) => {
    const deviation = Math.abs(actual - ideal);
    const isGood = deviation < 0.05; // Within 5% is good

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <div className={`inline-flex items-center px-2 py-1 rounded ${
            isGood ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            <span className="text-xs font-semibold">
              {isGood ? '✓' : '⚠'}
            </span>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Your Ratio</span>
            <span className="font-bold text-gray-900">{actual.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Ideal</span>
            <span className="text-gray-700">{ideal.toFixed(2)}</span>
          </div>
        </div>

        {/* Visual indicator */}
        <div className="mt-3 relative">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isGood ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min((actual / (ideal * 1.5)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Severity badge
  const getSeverityBadge = (severity) => {
    const styles = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-orange-100 text-orange-700',
      low: 'bg-yellow-100 text-yellow-700',
    };
    return styles[severity] || styles.medium;
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
          Symmetry Analysis
        </h3>
        
        <div className={`text-center p-6 rounded-lg ${getScoreBg(overallScore)}`}>
          <p className="text-sm text-gray-600 mb-2">Overall Balance Score</p>
          <p className={`text-5xl md:text-6xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
          </p>
          <p className="text-sm text-gray-500 mt-2">out of 100</p>
          <p className="text-sm font-medium text-gray-700 mt-3">
            {interpretation}
          </p>
        </div>

        {/* Lift Values */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Squat</p>
            <p className="text-lg font-bold text-gray-900">{lifts.squat || 0}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Bench</p>
            <p className="text-lg font-bold text-gray-900">{lifts.bench || 0}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Deadlift</p>
            <p className="text-lg font-bold text-gray-900">{lifts.deadlift || 0}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">OHP</p>
            <p className="text-lg font-bold text-gray-900">{lifts.ohp || 0}</p>
          </div>
        </div>
      </div>

      {/* Ratio Cards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4">Lift Ratios</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <RatioCard
            title="Squat / Deadlift"
            actual={ratios.squatToDeadlift}
            ideal={0.85}
            description="Measures leg strength balance"
          />
          <RatioCard
            title="Bench / Squat"
            actual={ratios.benchToSquat}
            ideal={0.70}
            description="Upper vs lower body strength"
          />
          <RatioCard
            title="OHP / Bench"
            actual={ratios.ohpToBench}
            ideal={0.625}
            description="Pressing strength balance"
          />
          <RatioCard
            title="Deadlift / Squat"
            actual={ratios.deadliftToSquat}
            ideal={1.20}
            description="Posterior chain strength"
          />
        </div>
      </div>

      {/* Imbalances & Recommendations */}
      {imbalances && imbalances.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">
            Detected Imbalances & Recommendations
          </h4>
          <div className="space-y-4">
            {imbalances.map((imbalance, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {/* Severity Indicator */}
                  <div className="flex-shrink-0 mt-1">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getSeverityBadge(imbalance.severity)}`}>
                      {imbalance.severity.toUpperCase()}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900 mb-1">
                      {imbalance.lift}
                    </h5>
                    <p className="text-sm text-gray-700 mb-2">
                      {imbalance.message}
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        💡 Recommendation
                      </p>
                      <p className="text-sm text-blue-800">
                        {imbalance.suggestion}
                      </p>
                    </div>
                    {imbalance.ratio && (
                      <div className="mt-2 text-xs text-gray-500">
                        Current ratio: {imbalance.ratio.toFixed(2)} | 
                        Ideal: {imbalance.ideal?.toFixed(2) || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Imbalances Message */}
      {(!imbalances || imbalances.length === 0) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-lg font-semibold text-green-900 mb-1">
            Excellent Balance!
          </p>
          <p className="text-sm text-green-700">
            No significant imbalances detected. Keep up the great work!
          </p>
        </div>
      )}
    </div>
  );
}

export default SymmetryDisplay;