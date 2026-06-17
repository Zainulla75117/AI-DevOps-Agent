import { useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Hero from './sections/Hero';
import Footer from './components/Footer';
import './styles/index.css';

// Lazy-load below-fold sections to reduce initial bundle and speed up first paint
const Features = lazy(() => import('./sections/Features'));
const HowItWorks = lazy(() => import('./sections/HowItWorks'));
const Showcase = lazy(() => import('./sections/Showcase'));
const Integrations = lazy(() => import('./sections/Integrations'));
const FAQ = lazy(() => import('./sections/FAQ'));

function App() {
  useEffect(() => {
    // Smooth scroll for anchor links
    const handleAnchorClick = (e) => {
      const href = e.target.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div className="min-h-screen bg-agentic-secondary text-agentic-text transition-colors duration-300">
      <Header />
      <main>
        <Hero />
        <Suspense fallback={null}>
          <Features />
          <HowItWorks />
          <Showcase />
          <Integrations />
          <FAQ />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;

