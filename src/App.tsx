import { useState, useEffect } from 'react';
import { MainLayout } from './components/layout';
import { LandingPage, LearnMorePage, InstructionsPage, ComparisonPage } from './components/pages';
import { useLoadSharedState } from './hooks/useLoadSharedState';
import { useAuthStore } from './stores/useAuthStore';

type MarketingPage = 'landing' | 'learnmore' | 'how-to-use' | 'comparison';

function getPageFromPath(): MarketingPage {
  const path = window.location.pathname;
  if (path === '/learnmore') return 'learnmore';
  if (path === '/how-to-use') return 'how-to-use';
  if (path === '/comparison') return 'comparison';
  return 'landing';
}

function App() {
  const { isAuthenticated, login } = useAuthStore();
  const [marketingPage, setMarketingPage] = useState<MarketingPage>(getPageFromPath);

  // Load shared state from URL on startup
  useLoadSharedState();

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setMarketingPage(getPageFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleGetStarted = () => {
    login('demo@robosim.dev');
  };

  const navigateTo = (page: MarketingPage) => {
    const path = page === 'landing' ? '/' : `/${page}`;
    window.history.pushState({}, '', path);
    setMarketingPage(page);
  };

  if (!isAuthenticated) {
    if (marketingPage === 'learnmore') {
      return (
        <LearnMorePage
          onBack={() => navigateTo('landing')}
          onGetStarted={handleGetStarted}
        />
      );
    }
    if (marketingPage === 'how-to-use') {
      return (
        <InstructionsPage
          onBack={() => navigateTo('landing')}
          onGetStarted={handleGetStarted}
        />
      );
    }
    if (marketingPage === 'comparison') {
      return (
        <ComparisonPage
          onBack={() => navigateTo('landing')}
          onGetStarted={handleGetStarted}
        />
      );
    }
    return (
      <LandingPage
        onLogin={handleGetStarted}
        onLearnMore={() => navigateTo('learnmore')}
        onInstructions={() => navigateTo('how-to-use')}
        onComparison={() => navigateTo('comparison')}
      />
    );
  }

  return <MainLayout />;
}

export default App;
