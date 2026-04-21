import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started with DevOps automation',
    features: [
      'Up to 3 cloud accounts',
      '10 deployments/month',
      'Basic CI/CD automation',
      'Community support',
      'Standard integrations',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$99',
    period: 'per month',
    description: 'For teams scaling their infrastructure operations',
    features: [
      'Unlimited cloud accounts',
      'Unlimited deployments',
      'Advanced CI/CD automation',
      'Kubernetes management',
      'Priority support',
      'All integrations',
      'Cost optimization insights',
      'Custom automation scripts',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'For organizations with advanced security and compliance needs',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'SLA guarantee (99.9%)',
      '24/7 phone support',
      'Custom integrations',
      'Advanced security features',
      'Compliance automation',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-agentic-secondary">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-xs uppercase font-medium tracking-[0.2em] text-agentic-primary/80 mb-3">Scale Predictably</div>
          <h2 className="text-4xl md:text-5xl font-light mb-4 font-display text-agentic-text">
            Simple, Transparent <span className="text-agentic-primary">Pricing</span>
          </h2>
          <p className="text-xl text-agentic-text/80 max-w-2xl mx-auto font-sans">
            Choose the plan that fits your team's needs
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-start">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative glass-effect rounded-2xl p-8 flex flex-col h-full bg-agentic-surface ${plan.popular
                  ? 'border-2 border-agentic-primary shadow-lg scale-100 md:scale-105 z-10'
                  : 'border border-agentic-text/10'
                } transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-agentic-primary rounded-full text-sm font-semibold text-white shadow-sm">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-normal mb-2 text-agentic-text font-display">{plan.name}</h3>
                <div className="flex items-baseline space-x-2 mb-2">
                  <span className="text-6xl font-light tracking-tighter text-agentic-text font-display">{plan.price}</span>
                  {plan.period !== 'forever' && (
                    <span className="text-xs uppercase tracking-widest font-medium text-agentic-text/50">/{plan.period}</span>
                  )}
                </div>
                <p className="text-agentic-text/80 text-sm font-sans">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-agentic-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-agentic-primary/20">
                      <Check className="w-3 h-3 text-agentic-primary" />
                    </div>
                    <span className="text-agentic-text/80 font-sans">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.a
                href="#get-started"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`block w-full text-center px-6 py-3 rounded-md font-semibold transition-all duration-300 ${plan.popular
                    ? 'bg-agentic-primary text-white hover:bg-[#E64A00] shadow-sm'
                    : 'bg-agentic-surface border border-agentic-text/10 text-agentic-text hover:border-agentic-text/30 shadow-sm'
                  }`}
              >
                {plan.cta}
              </motion.a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
