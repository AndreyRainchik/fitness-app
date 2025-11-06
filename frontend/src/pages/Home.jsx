import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white mb-12">
          <h1 className="text-6xl font-bold mb-4">💪 Fitness Tracker</h1>
          <p className="text-2xl mb-2">Your All-in-One Workout Companion</p>
          <p className="text-lg opacity-90">
            Track workouts • Analyze progress • Stay motivated
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-2xl p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Features
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="p-6 bg-blue-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-blue-900">
                📊 Muscle Group Visualization
              </h3>
              <p className="text-gray-700">
                See which muscle groups you've trained throughout the week with intuitive visual tracking.
              </p>
            </div>
            
            <div className="p-6 bg-green-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-green-900">
                🏆 Performance Benchmarking
              </h3>
              <p className="text-gray-700">
                Compare your lifts against population standards and track your progress over time.
              </p>
            </div>
            
            <div className="p-6 bg-purple-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-purple-900">
                ⚖️ Balance Analysis
              </h3>
              <p className="text-gray-700">
                Identify strength imbalances between muscle groups to prevent injuries.
              </p>
            </div>
            
            <div className="p-6 bg-orange-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-orange-900">
                📅 5/3/1 Programming
              </h3>
              <p className="text-gray-700">
                Automated progressive overload with intelligent weekly periodization.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-200 text-center"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-200 text-center"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="text-center text-white text-sm opacity-75">
          <p>Built with React, Node.js, and dedication to your gains 💪</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
