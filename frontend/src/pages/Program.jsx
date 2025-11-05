import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

function Program() {
  return (
    <Layout>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Training Programs</h1>
        <p className="text-gray-600">Manage your 5/3/1 and custom programs</p>
      </header>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">📅 5/3/1 Programming coming soon!</p>
          <p className="text-sm text-gray-500 mb-6">
            Automated progressive overload with weekly periodization
          </p>
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}

export default Program;