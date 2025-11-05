import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            💪 Fitness Tracker
          </h1>
          <p className="text-gray-600">
            Your all-in-one workout companion
          </p>
        </header>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome!</h2>
          <p className="text-gray-700">
            Frontend initialized successfully with React + Vite + Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;