import { useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import Hero from './sections/Hero';
import Features from './sections/Features';
import HowItWorks from './sections/HowItWorks';
import Showcase from './sections/Showcase';
import Integrations from './sections/Integrations';
import Pricing from './sections/Pricing';
import Testimonials from './sections/Testimonials';
import Footer from './components/Footer';
import './styles/index.css';

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
    <ThemeProvider>
      <div className="min-h-screen transition-colors duration-300">
        <Header />
        <main>
          <Hero />
          <Features />
          <HowItWorks />
          <Showcase />
          <Integrations />
          <Pricing />
          <Testimonials />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}

export default App;

