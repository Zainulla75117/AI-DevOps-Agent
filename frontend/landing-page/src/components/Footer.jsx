import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

const footerLinks = {
  Product: ['Features', 'Solutions', 'Pricing', 'Integrations'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
  Resources: ['Documentation', 'API Reference', 'Guides', 'Support'],
  Legal: ['Privacy', 'Terms', 'Security', 'Compliance'],
};

const socialLinks = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Mail, href: '#', label: 'Email' },
];

const Footer = () => {
  return (
    <footer className="relative border-t border-theme bg-footer backdrop-blur-xl">
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/My_Brand-Logo.png" 
                alt="InfraAgent Logo" 
                className="h-10 w-auto object-contain"
              />
              <span className="text-xl font-bold text-gradient text-heading">InfraAgent</span>
            </div>
          <p className="text-tertiary text-sm mb-4">
            AI-powered DevOps automation for modern teams.
          </p>
          <div className="flex space-x-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-lg glass-effect-hover border border-theme flex items-center justify-center text-tertiary hover:text-neon-green hover:border-neon-green/50 transition-all duration-300"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.a>
                );
              })}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-heading-color mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href={`#${link.toLowerCase()}`}
                      className="text-tertiary hover:text-neon-green transition-colors duration-200 text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-theme flex flex-col md:flex-row justify-between items-center">
          <p className="text-tertiary text-sm">
            © {new Date().getFullYear()} InfraAgent. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#privacy" className="text-tertiary hover:text-neon-green transition-colors text-sm">
              Privacy Policy
            </a>
            <a href="#terms" className="text-tertiary hover:text-neon-green transition-colors text-sm">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

