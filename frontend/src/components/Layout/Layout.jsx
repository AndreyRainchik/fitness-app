import React from 'react';
import Header from './Header';

function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
      <footer className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2025 Fitness Tracker. Built with dedication to your gains 💪</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;