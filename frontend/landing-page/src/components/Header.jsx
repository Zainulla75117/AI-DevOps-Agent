import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Features', 'Solutions', 'Showcase', 'Integrations', 'FAQ'];

  return (
    <motion.header
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
      }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out pb-12 pointer-events-none ${isScrolled
        ? 'bg-agentic-surface/70 backdrop-blur-md'
        : 'bg-transparent backdrop-blur-none'
        }`}
    >
      <div className="pointer-events-auto">
        <nav className={`container mx-auto transition-all duration-500 ${isScrolled ? 'px-6 md:px-8 py-4 md:py-5' : 'px-6 md:px-12 py-8 md:py-10'}`}>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 md:w-1/4 ml-10 md:ml-20">
            <motion.a
              href="#"
              whileHover={{ scale: 1.02 }}
              className="flex items-center"
            >
              <img
                src="/My_Brand-Logo_1.png"
                alt="InfraX Logo"
                className="h-6 md:h-8 w-auto object-contain"
              />
            </motion.a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center flex-1 space-x-10">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-base font-sans font-normal text-agentic-text/70 hover:text-agentic-text transition-colors duration-300 antialiased"
              >
                {item}
              </a>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center justify-end md:w-1/4 mr-10 md:mr-20 space-x-6">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-agentic-text/70 hover:text-agentic-text transition-colors focus:outline-none flex items-center justify-center"
              aria-label="Toggle dark mode"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ y: -20, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 20, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </motion.div>
              </AnimatePresence>
            </button>

            <a
              href="https://infraxai.vercel.app"
              className="text-base font-sans font-normal text-agentic-text/70 hover:text-agentic-primary transition-colors duration-300 antialiased relative py-1 group/login"
            >
              <span>Login</span>
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-agentic-primary scale-x-0 group-hover/login:scale-x-100 transition-transform duration-300 origin-left" />
            </a>

            <motion.a
              href="https://infraxai.vercel.app/register"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="relative inline-flex items-center justify-center overflow-hidden rounded-full p-[2px] hover:shadow-lg transition-all duration-300 group bg-agentic-text/5"
            >
              <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_30%,#3b82f6_47%,#ffffff_50%,transparent_50%,transparent_80%,#3b82f6_97%,#ffffff_100%)]" />
              <span className="relative inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-agentic-text text-agentic-surface text-[13px] font-sans font-semibold tracking-wide antialiased w-full h-full transition-colors group-hover:bg-agentic-text/95">
                Sign Up
              </span>
            </motion.a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-agentic-text hover:text-agentic-primary transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 space-y-4 border-t border-agentic-text/10 pt-4 bg-agentic-surface px-4 rounded-b-xl shadow-lg"
            >
              {navItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-agentic-text/80 hover:text-agentic-primary transition-colors duration-200"
                >
                  {item}
                </a>
              ))}

              <button
                onClick={() => {
                  setIsDarkMode(!isDarkMode);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center w-full text-left text-agentic-text/80 hover:text-agentic-primary transition-colors duration-200"
              >
                <div className="mr-3 p-1.5 rounded-md bg-agentic-text/5">
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </div>
                {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </button>

              <a
                href="https://infraxai.vercel.app"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-agentic-text/80 font-medium transition-all duration-300 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-agentic-primary hover:to-teal-500"
              >
                Login
              </a>
              <motion.a
                href="https://infraxai.vercel.app/register"
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full px-6 py-2 bg-agentic-primary text-white rounded-md font-medium text-center shadow-sm"
              >
                Sign Up
              </motion.a>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      </div>
    </motion.header>
  );
};

export default Header;
