import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWAPrompt Component
 * Handles PWA installation prompt and service worker updates
 * Update prompts only show when running as installed PWA (standalone mode)
 */
const PWAPrompt = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Service worker registration and update handling
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Check if app is running in standalone mode (installed as PWA)
  useEffect(() => {
    const checkStandaloneMode = () => {
      // Check multiple methods to detect standalone mode
      const isStandaloneBrowser = window.matchMedia('(display-mode: standalone)').matches;
      const isStandaloneIOS = ('standalone' in window.navigator) && (window.navigator.standalone);
      const isStandaloneAndroid = document.referrer.includes('android-app://');
      
      return isStandaloneBrowser || isStandaloneIOS || isStandaloneAndroid;
    };

    setIsStandalone(checkStandaloneMode());

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => {
      setIsStandalone(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show install button
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to the install prompt: ${outcome}`);

    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    // Store that user dismissed it (optional - to not show again for a while)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleUpdateClick = () => {
    updateServiceWorker(true);
  };

  const handleDismissUpdate = () => {
    setNeedRefresh(false);
  };

  const handleDismissOffline = () => {
    setOfflineReady(false);
  };

  return (
    <>
      {/* Install Prompt - Only show in browser (not standalone) */}
      {showInstallPrompt && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                Install Fitness Tracker
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Install our app for quick access, offline support, and a better experience!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Available Prompt - ONLY show in standalone mode (installed PWA) */}
      {needRefresh && isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white border-2 border-green-500 rounded-lg shadow-lg p-4 z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                Update Available
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                A new version is available. Reload to update and get the latest features!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateClick}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Reload
                </button>
                <button
                  onClick={handleDismissUpdate}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Ready Notification - Only show in standalone mode */}
      {offlineReady && isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 z-50 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                Ready to Work Offline
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                The app is now ready to work offline!
              </p>
              <button
                onClick={handleDismissOffline}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAPrompt;