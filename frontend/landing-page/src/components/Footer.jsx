import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

const socialLinks = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Mail, href: '#', label: 'Email' },
];

const Footer = () => {
  return (
    <footer className="border-t border-agentic-text/10 bg-agentic-surface">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Logo + tagline */}
          <div className="flex items-center space-x-4">
            <img 
              src="/My_Brand-Logo_1.png" 
              alt="InfraX Logo" 
              className="h-8 w-auto object-contain"
            />
            <span className="text-agentic-text/60 text-sm font-sans">AI-powered DevOps automation</span>
          </div>

          {/* Social Links */}
          <div className="flex space-x-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1 }}
                  className="w-9 h-9 rounded-md border border-agentic-text/10 flex items-center justify-center text-agentic-text/60 hover:text-agentic-primary hover:border-agentic-primary/30 transition-colors"
                  aria-label={social.label}
                >
                  <Icon className="w-4 h-4" />
                </motion.a>
              );
            })}
          </div>

          {/* Copyright + links */}
          <div className="flex items-center space-x-6 text-sm text-agentic-text/50 font-sans">
            <a href="#privacy" className="hover:text-agentic-primary transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-agentic-primary transition-colors">Terms</a>
            <span>© {new Date().getFullYear()} InfraX</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
