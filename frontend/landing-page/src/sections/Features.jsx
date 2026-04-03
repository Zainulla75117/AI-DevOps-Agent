import { motion } from 'framer-motion';
import {
  Network,
  GitBranch,
  Container,
  BarChart3,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';

const features = [
  {
    icon: Network,
    title: 'AI Infra Provisioning',
    description: 'Auto-generate Terraform, CloudFormation, and Pulumi configurations. Deploy infrastructure across AWS, Azure, and GCP with intelligent resource optimization.',
    color: 'from-neon-green to-neon-green-light',
  },
  {
    icon: GitBranch,
    title: 'CI/CD Automation',
    description: 'Create and optimize pipelines for Jenkins, GitHub Actions, and GitLab. Automatically detect and fix pipeline issues before deployment.',
    color: 'from-neon-green-light to-neon-blue',
  },
  {
    icon: Container,
    title: 'Kubernetes Management',
    description: 'Deploy, upgrade, and scale workloads automatically. Handle rolling updates, health checks, and resource allocation with zero downtime.',
    color: 'from-neon-blue to-neon-blue-light',
  },
  {
    icon: BarChart3,
    title: 'Monitoring & Alerting',
    description: 'Auto-configure monitors for Prometheus, Grafana, and Datadog. Set up intelligent alerting rules based on your infrastructure patterns.',
    color: 'from-neon-blue-light to-neon-green',
  },
  {
    icon: TrendingDown,
    title: 'Cost Optimization',
    description: 'Real-time cloud cost insights and recommendations. Automatically right-size resources and identify unused infrastructure to reduce spend.',
    color: 'from-neon-green to-neon-blue',
  },
  {
    icon: ShieldCheck,
    title: 'Security Automation',
    description: 'Enforce security policies, run automated scans, and maintain compliance. Integrate with security tools for continuous protection.',
    color: 'from-neon-blue to-neon-green-light',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-heading">
            Powerful Features for{' '}
            <span className="text-gradient">Modern DevOps</span>
          </h2>
          <p className="text-xl text-secondary max-w-2xl mx-auto text-sharp">
            Everything you need to automate and optimize your infrastructure operations
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="glass-effect-hover rounded-xl p-8 transition-all duration-300 group card-glow relative"
              >
                <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${feature.color} p-3 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <Icon className="w-full h-full text-white drop-shadow-lg" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-heading-color group-hover:text-gradient-green transition-all duration-300 text-heading">
                  {feature.title}
                </h3>
                <p className="text-secondary leading-relaxed text-sharp">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;

