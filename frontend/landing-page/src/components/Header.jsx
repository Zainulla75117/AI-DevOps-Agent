import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Features', 'Solutions', 'Pricing', 'Docs'];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-header backdrop-blur-xl border-b border-theme shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="#"
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <img 
              src="/My_Brand-Logo_1.png" 
              alt="InfraAgent Logo" 
              className="h-10 w-auto object-contain"
            />
            <span className="text-xl font-bold text-gradient text-heading">InfraAgent</span>
          </motion.a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-secondary hover:text-neon-green transition-colors duration-200 font-medium"
              >
                {item}
              </a>
            ))}
            <a
              href="http://localhost:5173"
              className="text-secondary hover:text-neon-green transition-colors duration-200 font-medium"
            >
              Login
            </a>
            {/* Theme Toggle Button */}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg glass-effect border border-theme hover:border-neon-green/50 transition-all duration-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-neon-green" />
              ) : (
                <Moon className="w-5 h-5 text-neon-blue" />
              )}
            </motion.button>
            <motion.a
              href="#get-started"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 bg-gradient-to-r from-neon-green via-neon-green-light to-neon-blue text-white rounded-lg font-medium hover:shadow-lg hover:shadow-neon-green/50 transition-all duration-300"
            >
              Get Started
            </motion.a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-tertiary hover:text-neon-green transition-colors"
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
              className="md:hidden mt-4 pb-4 space-y-4 border-t border-theme pt-4"
            >
              {navItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-tertiary hover:text-neon-green transition-colors duration-200"
                >
                  {item}
                </a>
              ))}
              <a
                href="http://localhost:5173"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-tertiary hover:text-neon-green transition-colors duration-200"
              >
                Login
              </a>
              {/* Theme Toggle Button - Mobile */}
              <motion.button
                onClick={() => {
                  toggleTheme();
                  setIsMobileMenuOpen(false);
                }}
                whileTap={{ scale: 0.95 }}
                className="w-full px-6 py-2 glass-effect border border-theme rounded-lg font-medium flex items-center justify-center space-x-2 hover:border-neon-green/50 transition-all duration-300"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-5 h-5 text-neon-green" />
                    <span className="text-secondary">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-5 h-5 text-neon-blue" />
                    <span className="text-secondary">Dark Mode</span>
                  </>
                )}
              </motion.button>
              <motion.a
                href="#get-started"
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-6 py-2 bg-gradient-to-r from-neon-green to-neon-blue text-white rounded-lg font-medium text-center"
              >
                Get Started
              </motion.a>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
};

export default Header;

