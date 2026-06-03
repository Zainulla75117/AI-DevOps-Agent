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
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-agentic-primary/80 mb-3">
            Knowledge Base
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 font-display text-agentic-text">
            Commonly Asked <span className="text-agentic-primary">Questions</span>
          </h2>
          <p className="text-lg md:text-xl text-agentic-text/70 leading-relaxed max-w-2xl mx-auto font-sans">
            Everything you need to know about the future of automation.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="border-b border-agentic-text/10"
            >
              <button
                onClick={() => toggleOpen(index)}
                className="w-full flex items-center justify-between py-6 text-left focus:outline-none group"
              >
                <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-agentic-text font-display pr-8 group-hover:text-agentic-primary transition-colors">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: openIndex === index ? 45 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex-shrink-0"
                >
                  <Plus className="w-6 h-6 text-agentic-primary" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="text-base leading-relaxed text-agentic-text/70 font-sans pb-8 max-w-3xl">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
