import { motion } from 'framer-motion';
import { 
  Cloud, 
  Box, 
  Container, 
  Wrench, 
  GitBranch, 
  Rocket, 
  Building2,
  BarChart3,
  TrendingUp
} from 'lucide-react';

const integrations = [
  { name: 'AWS', icon: Cloud },
  { name: 'Azure', icon: Box },
  { name: 'GCP', icon: Cloud },
  { name: 'Kubernetes', icon: Container },
  { name: 'Docker', icon: Container },
  { name: 'Jenkins', icon: Wrench },
  { name: 'GitHub', icon: GitBranch },
  { name: 'GitLab', icon: GitBranch },
  { name: 'ArgoCD', icon: Rocket },
  { name: 'Terraform', icon: Building2 },
  { name: 'Prometheus', icon: BarChart3 },
  { name: 'Grafana', icon: TrendingUp },
];

const Integrations = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-heading">
            Seamless <span className="text-gradient">Integrations</span>
          </h2>
          <p className="text-xl text-secondary max-w-2xl mx-auto text-sharp">
            Works with all your favorite DevOps tools and cloud providers
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ scale: 1.1, y: -5 }}
                className="glass-effect-hover rounded-xl p-6 flex flex-col items-center justify-center space-y-3 transition-all duration-300 group cursor-pointer card-glow"
              >
                <div className="w-12 h-12 flex items-center justify-center mb-2 group-hover:scale-125 transition-transform duration-300">
                  {(() => {
                    const Icon = integration.icon;
                    return <Icon className="w-8 h-8 text-tertiary group-hover:text-neon-green transition-colors duration-300" />;
                  })()}
                </div>
                <span className="text-sm font-medium text-secondary group-hover:text-gradient-green transition-all duration-300">
                  {integration.name}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mt-12"
          >
          <p className="text-secondary mb-6">
            And many more integrations available
          </p>
          <motion.a
            href="#integrations"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block px-6 py-3 glass-effect-hover border border-theme text-heading-color rounded-lg font-medium transition-all duration-300"
          >
              View All Integrations
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Integrations;

