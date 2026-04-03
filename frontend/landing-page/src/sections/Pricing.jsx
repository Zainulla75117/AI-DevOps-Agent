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
    gradient: 'from-gray-700 to-gray-800',
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
    gradient: 'from-neon-green to-neon-blue',
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
    gradient: 'from-neon-blue to-neon-green-light',
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-heading">
            Simple, Transparent <span className="text-gradient">Pricing</span>
          </h2>
          <p className="text-xl text-secondary max-w-2xl mx-auto text-sharp">
            Choose the plan that fits your team's needs
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative glass-effect-hover rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-neon-green/60 scale-105 md:scale-110 shadow-xl shadow-neon-green/20'
                  : 'border border-theme'
              } transition-all duration-300 card-glow`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-neon-green via-neon-green-light to-neon-blue rounded-full text-sm font-semibold text-white shadow-lg shadow-neon-green/30">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2 text-heading-color text-heading">{plan.name}</h3>
                <div className="flex items-baseline space-x-2 mb-2">
                  <span className="text-4xl font-bold text-gradient text-heading">{plan.price}</span>
                  {plan.period !== 'forever' && (
                    <span className="text-secondary text-sharp">/{plan.period}</span>
                  )}
                </div>
                <p className="text-secondary text-sm text-sharp">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-neon-green/30">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.a
                href="#get-started"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-neon-green via-neon-green-light to-neon-blue text-white hover:shadow-lg hover:shadow-neon-green/50'
                    : 'glass-effect border border-theme text-heading-color hover:border-neon-green/60 hover:bg-theme-surface'
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

