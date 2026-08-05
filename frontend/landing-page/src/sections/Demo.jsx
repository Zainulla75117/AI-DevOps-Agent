import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Mail, 
  CheckCircle2, 
  Bell, 
  Calendar, 
  Play,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

const expectations = [
  { text: 'Interactive walkthrough' },
  { text: 'AI-powered workflow demonstration' },
  { text: 'Real-world use cases' },
  { text: 'Live product preview' },
  { text: 'Launching soon' }
];

const Demo = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Simulate submission success
    setIsSubmitted(true);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-agentic-secondary/50 pt-28 pb-20 px-6 font-sans">
      <div className="container mx-auto max-w-4xl">
        
        {/* Breadcrumb / Back Navigation */}
        <div className="mb-8">
          <a 
            href="/" 
            className="inline-flex items-center text-sm font-medium text-agentic-text/60 hover:text-agentic-primary transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </a>
        </div>

        {/* Main Card Container */}
        <div className="bg-agentic-surface border border-agentic-text/10 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left / Hero Column: Illustration / Placeholder */}
          <div className="md:col-span-5 bg-gradient-to-br from-emerald-500/10 via-agentic-primary/10 to-teal-500/5 dark:from-slate-900 dark:via-[#1b2a47] dark:to-slate-950 p-8 flex flex-col justify-between text-agentic-text dark:text-white relative overflow-hidden min-h-[300px] md:min-h-[480px] border-b md:border-b-0 md:border-r border-agentic-text/10">
            
            {/* Subtle Grid overlay */}
            <div className="absolute inset-0 bg-dashed-grid opacity-20 dark:opacity-10 pointer-events-none" />
            
            {/* Absolute decorative gradient glow */}
            <div className="absolute top-12 left-12 w-32 h-32 rounded-full bg-agentic-primary/20 blur-3xl pointer-events-none" />
            
            <div className="relative z-10">
              <span className="px-3 py-1 text-[10px] font-semibold tracking-wider text-agentic-primary bg-agentic-primary/15 dark:bg-agentic-primary/10 border border-agentic-primary/30 dark:border-agentic-primary/20 rounded-full uppercase">
                Under Development
              </span>
            </div>

            {/* Visual Placeholder Illustration */}
            <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Outer spin rings */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-2 border-dashed border-agentic-text/20 dark:border-white/20"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-2 rounded-full border border-dashed border-agentic-primary/50 dark:border-agentic-primary/40"
                />
                {/* Icon center */}
                <div className="w-16 h-16 rounded-full bg-agentic-primary text-white flex items-center justify-center shadow-lg relative">
                  <Play className="w-6 h-6 fill-current pl-1 animate-pulse" />
                </div>
              </div>
              <span className="text-xs text-agentic-text/60 dark:text-white/50 font-mono mt-5 tracking-wide">interactive_demo.sh</span>
            </div>

            <div className="relative z-10 text-center md:text-left">
              <p className="text-[11px] text-agentic-text/40 dark:text-white/40 font-mono">InfraX v1.0.0-rc1</p>
            </div>
          </div>

          {/* Right Column: Content and Email Ingestion */}
          <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between bg-agentic-surface">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-agentic-text leading-tight">
                Product Demo Coming Soon
              </h1>
              
              <p className="text-sm text-agentic-text/70 mt-4 leading-relaxed font-sans">
                We're putting the finishing touches on our interactive product demo to ensure the best possible experience. Thank you for your patience!
              </p>

              {/* What Users Can Expect Section */}
              <div className="mt-8 pt-6 border-t border-agentic-text/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-agentic-text/50 font-mono">
                  What you can expect
                </h3>
                <ul className="mt-4 space-y-3">
                  {expectations.map((item, idx) => (
                    <motion.li 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center text-sm text-agentic-text/80 font-sans"
                    >
                      <Check className="w-4 h-4 text-agentic-primary mr-3 shrink-0" />
                      <span>{item.text}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Call to Actions / Email Ingestion */}
            <div className="mt-8 pt-6 border-t border-agentic-text/10">
              <AnimatePresence mode="wait">
                {!isSubmitted ? (
                  <motion.form 
                    key="form"
                    onSubmit={handleSubmit}
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="relative">
                      <input 
                        type="email" 
                        placeholder="Enter your work email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full px-4 py-3 pl-11 bg-agentic-secondary border ${
                          error ? 'border-red-500' : 'border-agentic-text/15'
                        } rounded-lg text-sm text-agentic-text placeholder-agentic-text/40 focus:outline-none focus:border-agentic-primary transition-all font-sans`}
                      />
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-agentic-text/40" />
                    </div>

                    {error && (
                      <p className="text-xs text-red-500 font-medium font-sans pl-1">{error}</p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        className="px-6 py-3 bg-agentic-primary hover:bg-[#059669] text-white font-medium text-sm rounded-lg shadow-md transition-colors flex items-center justify-center space-x-2 group shrink-0"
                      >
                        <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Notify Me</span>
                      </button>
                      <a
                        href="/"
                        className="px-6 py-3 border border-agentic-text/15 hover:border-agentic-text/30 text-agentic-text font-medium text-sm rounded-lg transition-colors flex items-center justify-center"
                      >
                        Back to Home
                      </a>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-agentic-primary/10 border border-agentic-primary/20 rounded-lg flex items-start space-x-3 text-agentic-primary"
                  >
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Notification request logged!</h4>
                      <p className="text-xs text-agentic-text/70 mt-1 leading-relaxed">
                        We'll alert you the moment the interactive sandbox environments go live.
                      </p>
                      <a
                        href="/"
                        className="inline-flex items-center text-xs font-semibold mt-3 text-agentic-primary hover:underline"
                      >
                        Back to homepage <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom early preview access note */}
              <p className="text-xs text-agentic-text/50 text-center md:text-left mt-6 font-sans">
                Need an early preview?{' '}
                <a 
                  href="mailto:contact@infrax.run" 
                  className="text-agentic-primary hover:underline font-semibold"
                >
                  Contact us for early access.
                </a>
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default Demo;
