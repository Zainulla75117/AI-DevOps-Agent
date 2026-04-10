import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Features', 'Solutions'];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-agentic-surface/95 backdrop-blur-md border-b border-agentic-text/10 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="#"
            whileHover={{ scale: 1.05 }}
            className="flex items-center"
          >
            <img 
              src="/My_Brand-Logo_1.png" 
              alt="InfraX Logo" 
              className="h-10 w-auto object-contain"
            />
          </motion.a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-agentic-text/80 hover:text-agentic-primary transition-colors duration-200 font-medium"
              >
                {item}
              </a>
            ))}
            <a
              href="http://localhost:5173"
              className="text-agentic-text/80 transition-all duration-300 font-medium hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-agentic-primary hover:to-teal-500"
            >
              Login
            </a>
            
            <motion.a
              href="http://localhost:5173"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 bg-agentic-primary text-white rounded-md font-medium hover:bg-[#265A4B] transition-colors duration-300 shadow-sm"
            >
              Sign Up
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
              <a
                href="http://localhost:5173"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-agentic-text/80 font-medium transition-all duration-300 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-agentic-primary hover:to-teal-500"
              >
                Login
              </a>
              <motion.a
                href="http://localhost:5173"
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
    </motion.header>
  );
};

export default Header;
