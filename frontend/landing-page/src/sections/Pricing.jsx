import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    priceMonthly: '$0',
    priceYearly: '$0',
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
    priceMonthly: '$99',
    priceYearly: '$79',
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
    priceMonthly: 'Custom',
    priceYearly: 'Custom',
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
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Background spotlights */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-agentic-primary/5 to-blue-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Scale Predictably</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            Simple, Transparent <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">Pricing</span>
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Choose the plan that fits your team's needs
          </p>
        </motion.div>

        {/* Sliding Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-16">
          <span className={`text-sm font-semibold tracking-wide font-sans transition-colors duration-250 ${billingPeriod === 'monthly' ? 'text-agentic-text' : 'text-agentic-text/40'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
            className="w-14 h-8 rounded-full bg-agentic-text/10 p-1 transition-colors duration-300 relative focus:outline-none cursor-pointer"
            aria-label="Toggle billing period"
          >
            <motion.div
              layout
              className="w-6 h-6 rounded-full bg-agentic-primary shadow-sm"
              animate={{ x: billingPeriod === 'monthly' ? 0 : 24 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-sm font-semibold tracking-wide font-sans transition-colors duration-250 flex items-center ${billingPeriod === 'yearly' ? 'text-agentic-text' : 'text-agentic-text/40'}`}>
            Yearly
            <span className="ml-2 px-2 py-0.5 text-[9px] font-bold font-mono text-white bg-agentic-primary rounded-full tracking-widest uppercase">
              Save 20%
            </span>
          </span>
        </div>

        {/* Pricing Layout Container */}
        <div className="max-w-6xl mx-auto border border-agentic-text/10 rounded-2xl overflow-hidden grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-agentic-text/10">
          {plans.map((plan, index) => {
            const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;
            const hasPeriod = plan.period !== 'forever' && price !== 'Custom';
            
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative p-8 md:p-10 flex flex-col h-full overflow-hidden transition-all duration-300 ${
                  plan.popular ? 'bg-agentic-primary/[0.01]' : ''
                }`}
              >
                {/* Popular Indicator Bar */}
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-r from-agentic-primary via-blue-500 to-agentic-primary" />
                )}

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-agentic-text font-display">
                      {plan.name}
                    </h3>
                    {plan.popular && (
                      <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-agentic-primary px-2 py-0.5 border border-agentic-primary/20 rounded-md">
                        Popular
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-baseline space-x-2 mb-4 mt-4">
                    <span className="text-5xl md:text-6xl font-light tracking-tighter text-agentic-text font-display">
                      {price}
                    </span>
                    {hasPeriod && (
                      <span className="text-xs uppercase tracking-widest font-bold text-agentic-text/40">
                        {billingPeriod === 'monthly' ? '/mo' : '/mo'}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-agentic-text/60 text-sm leading-relaxed font-sans mt-2">
                    {plan.description}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-4 mb-10 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <div className="w-5 h-5 rounded-full bg-agentic-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-agentic-primary/20">
                        <Check className="w-3 h-3 text-agentic-primary" />
                      </div>
                      <span className="text-sm text-agentic-text/80 font-sans leading-tight">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Call To Action Button */}
                <motion.a
                  href="#get-started"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`block w-full text-center px-6 py-3 rounded-lg text-sm font-semibold tracking-wide transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-agentic-primary to-blue-600 text-white hover:opacity-95 shadow-md'
                      : 'bg-agentic-surface border border-agentic-text/10 text-agentic-text hover:border-agentic-text/25 hover:bg-agentic-text/[0.01]'
                  }`}
                >
                  {plan.cta}
                </motion.a>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
