import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldScroll = window.scrollY > 40;
          setIsScrolled((prev) => (prev !== shouldScroll ? shouldScroll : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Features', 'Solutions', 'Showcase', 'Integrations', 'FAQ'];

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out pb-12 pointer-events-none"
    >
      {/* Background overlay with blur and mask (only mask when mobile menu is closed) */}
      <div
        className={`absolute inset-0 transition-all duration-500 pointer-events-none z-0 ${isScrolled || isMobileMenuOpen
            ? 'opacity-100 bg-agentic-surface/75 backdrop-blur-md'
            : 'opacity-0 bg-transparent backdrop-blur-none'
          }`}
        style={{
          WebkitMaskImage: isMobileMenuOpen
            ? 'none'
            : 'linear-gradient(to bottom, black 40%, transparent 100%)',
          maskImage: isMobileMenuOpen
            ? 'none'
            : 'linear-gradient(to bottom, black 40%, transparent 100%)'
        }}
      />

      <div className="pointer-events-auto relative z-10">
        <nav className={`container mx-auto transition-all duration-500 ${isScrolled ? 'px-6 md:px-8 py-4 md:py-5' : 'px-6 md:px-12 py-8 md:py-10'}`}>
          <div className="flex items-center justify-between">
            {/* Logo - ml-0 on mobile, md:ml-20 on desktop */}
            <div className="flex items-center flex-shrink-0 md:w-1/4 ml-0 md:ml-20">
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
                onClick={toggleTheme}
                className="p-2 text-agentic-text/70 hover:text-agentic-text transition-colors focus:outline-none flex items-center justify-center"
                aria-label="Toggle dark mode"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={theme}
                    initial={{ y: -20, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 20, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
                initial={{ opacity: 0, y: -15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="md:hidden mt-3 p-6 space-y-5 border border-agentic-text/10 bg-agentic-surface/95 backdrop-blur-xl rounded-2xl shadow-xl z-50 relative"
              >
                <div className="space-y-4">
                  {navItems.map((item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase()}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block text-base font-sans font-medium text-agentic-text/80 hover:text-agentic-primary active:text-agentic-primary transition-colors duration-200"
                    >
                      {item}
                    </a>
                  ))}
                </div>

                <div className="h-[1px] bg-agentic-text/10 my-3" />

                <div className="space-y-4">
                  <button
                    onClick={() => {
                      toggleTheme();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full text-left text-base font-sans font-medium text-agentic-text/85 hover:text-agentic-primary"
                  >
                    <div className="flex items-center">
                      <div className="mr-3 p-2 rounded-lg bg-agentic-text/5 text-agentic-text/70 flex items-center justify-center">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                      </div>
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    <div className="w-8 h-5 bg-agentic-text/10 dark:bg-white/10 rounded-full p-[2px] transition-colors duration-300 flex items-center justify-start dark:justify-end">
                      <div className="w-4 h-4 bg-agentic-primary rounded-full shadow-md" />
                    </div>
                  </button>

                  <a
                    href="https://infraxai.vercel.app"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-base font-sans font-medium text-agentic-text/85 hover:text-agentic-primary py-2"
                  >
                    Login
                  </a>

                  <motion.a
                    href="https://infraxai.vercel.app/register"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="relative flex items-center justify-center overflow-hidden rounded-full p-[2px] hover:shadow-lg transition-all duration-300 w-full bg-agentic-text/5"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_30%,#3b82f6_47%,#ffffff_50%,transparent_50%,transparent_80%,#3b82f6_97%,#ffffff_100%)]" />
                    <span className="relative flex items-center justify-center px-6 py-2.5 rounded-full bg-agentic-text text-agentic-surface text-[13px] font-sans font-semibold tracking-wide antialiased w-full h-full transition-colors">
                      Sign Up
                    </span>
                  </motion.a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </motion.header>
  );
};

export default Header;
