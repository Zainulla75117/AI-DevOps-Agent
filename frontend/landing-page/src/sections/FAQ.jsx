import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

const faqs = [
  {
    question: 'What actually is DevOps?',
    answer: 'DevOps is the culture, practices, and tooling that unites software development (Dev) and IT operations (Ops). It aims to completely eliminate the historical friction between writing code and deploying it, allowing teams to deliver updates rapidly, reliably, and continuously.',
  },
  {
    question: 'Why does a company need DevOps?',
    answer: 'Without DevOps, scaling a product becomes chaotic. Deployments become bottlenecks, infrastructure drifts into disrepair, and engineers spend more time fixing server environments than building features. DevOps automates testing, security, and deployments so companies can scale predictably and safely.',
  },
  {
    question: 'How does InfraX solve these problems?',
    answer: 'InfraX acts as an autonomous AI infrastructure engineer. Instead of spending weeks manually writing Terraform or wrestling with CI/CD scripts, you simply describe what you need. InfraX automatically provisions the cloud resources, configures the pipelines, and manages the orchestration—compressing months of DevOps engineering into seconds.',
  },
  {
    question: 'What cloud providers do you support?',
    answer: 'InfraX natively integrates with Amazon Web Services (AWS), Google Cloud Platform (GCP), and Microsoft Azure. We also provide out-of-the-box support for popular CI/CD platforms like GitHub Actions, GitLab CI, and Jenkins.',
  },
  {
    question: 'Do I need to know how to write Terraform or automation scripts?',
    answer: 'Not at all. InfraX was designed to completely abstract away the underlying infrastructure-as-code languages. You communicate with the agent in plain English, and it writes, validates, and deploys the underlying Terraform, CloudFormation, or pipeline scripts for you.',
  },
  {
    question: 'Is it safe to give an AI access to my cloud environments?',
    answer: 'Security is at the core of InfraX. The agent operates within strict, principle-of-least-privilege IAM roles that you define. Every generated plan is validated against standard security compliance frameworks before execution, and you maintain complete approval control over all production deployments.',
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleOpen = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section id="faq" className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Subtle background glow */}
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-agentic-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-12 gap-16 items-start">
          
          {/* Left Column - Header details & CTA */}
          <div className="lg:col-span-5 flex flex-col items-start text-left lg:sticky lg:top-32">
            <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">
              Knowledge Base
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text leading-tight animate-fade-in">
              Commonly Asked <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">Questions</span>
            </h2>
            <p className="text-base text-agentic-text/60 leading-relaxed font-sans max-w-md">
              Everything you need to know about the future of cloud infrastructure automation and AI DevOps.
            </p>
            
            {/* Help Callout */}
            <div className="mt-10 border-t border-agentic-text/10 pt-8 w-full">
              <h4 className="text-sm font-semibold tracking-wide text-agentic-text mb-2 font-display">Still have questions?</h4>
              <p className="text-xs leading-relaxed text-agentic-text/50 font-sans mb-5 max-w-xs">
                Can't find the answer you're looking for? Message our support team and talk directly to our engineering department.
              </p>
              <motion.a
                whileHover={{ x: 3 }}
                href="mailto:support@infraxai.com"
                className="inline-flex items-center space-x-2 text-xs font-mono font-bold tracking-wider uppercase text-agentic-primary hover:text-blue-500 transition-colors"
              >
                <span>Contact Engineering</span>
                <span>→</span>
              </motion.a>
            </div>
          </div>

          {/* Right Column - FAQ Accordion Items */}
          <div className="lg:col-span-7 space-y-2 w-full">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="border-b border-agentic-text/10"
                >
                  <button
                    onClick={() => toggleOpen(index)}
                    className="w-full flex items-center justify-between py-6 text-left focus:outline-none group cursor-pointer"
                  >
                    <h3 className={`text-base md:text-lg font-semibold tracking-tight pr-6 font-display transition-all duration-300 transform group-hover:translate-x-1 ${
                      isOpen ? 'text-agentic-primary' : 'text-agentic-text/80 group-hover:text-agentic-text'
                    }`}>
                      {faq.question}
                    </h3>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="flex-shrink-0"
                    >
                      <Plus className={`w-5 h-5 transition-colors duration-300 ${isOpen ? 'text-agentic-primary' : 'text-agentic-text/40 group-hover:text-agentic-primary'}`} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm leading-relaxed text-agentic-text/60 font-sans pb-6 pr-4 max-w-3xl">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
};

export default FAQ;
