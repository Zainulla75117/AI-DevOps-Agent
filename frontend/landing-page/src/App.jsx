import { useEffect, useState, lazy, Suspense } from 'react';
import Header from './components/Header';
import Hero from './sections/Hero';
import Footer from './components/Footer';
import './styles/index.css';

// Lazy-load sections to reduce initial bundle and speed up first paint
const Features = lazy(() => import('./sections/Features'));
const HowItWorks = lazy(() => import('./sections/HowItWorks'));
const Showcase = lazy(() => import('./sections/Showcase'));
const Integrations = lazy(() => import('./sections/Integrations'));
const FAQ = lazy(() => import('./sections/FAQ'));
const Demo = lazy(() => import('./sections/Demo'));

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);

      // Handle scrolling to anchor tags if returning from /demo to a route with an anchor hash
      const hash = window.location.hash;
      if (path !== '/demo' && hash) {
        setTimeout(() => {
          const targetId = hash.substring(1);
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // Intercept clicks on links for SPA routing
    const handleLinkClick = (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      
      // Ignore external or non-http links
      if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
        return;
      }

      if (href === '/demo') {
        e.preventDefault();
        window.history.pushState(null, '', '/demo');
        setCurrentPath('/demo');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else if (href.startsWith('#') || href === '/') {
        // If we are currently on the `/demo` view and click an anchor, route to home and then scroll
        if (window.location.pathname === '/demo') {
          e.preventDefault();
          window.history.pushState(null, '', href === '/' ? '/' : `/${href}`);
          setCurrentPath('/');
          
          if (href.startsWith('#')) {
            setTimeout(() => {
              const targetId = href.substring(1);
              const targetElement = document.getElementById(targetId);
              if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          // Standard scroll on landing page
          if (href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  return (
    <div className="min-h-screen bg-agentic-secondary text-agentic-text transition-colors duration-300">
      <Header />
      <main>
        <Suspense fallback={null}>
          {currentPath === '/demo' ? (
            <Demo />
          ) : (
            <>
              <Hero />
              <Features />
              <HowItWorks />
              <Showcase />
              <Integrations />
              <FAQ />
            </>
          )}
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;

