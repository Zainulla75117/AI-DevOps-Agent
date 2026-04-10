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
  },
  {
    icon: GitBranch,
    title: 'CI/CD Automation',
    description: 'Create and optimize pipelines for Jenkins, GitHub Actions, and GitLab. Automatically detect and fix pipeline issues before deployment.',
  },
  {
    icon: Container,
    title: 'Kubernetes Management',
    description: 'Deploy, upgrade, and scale workloads automatically. Handle rolling updates, health checks, and resource allocation with zero downtime.',
  },
  {
    icon: BarChart3,
    title: 'Monitoring & Alerting',
    description: 'Auto-configure monitors for Prometheus, Grafana, and Datadog. Set up intelligent alerting rules based on your infrastructure patterns.',
  },
  {
    icon: TrendingDown,
    title: 'Cost Optimization',
    description: 'Real-time cloud cost insights and recommendations. Automatically right-size resources and identify unused infrastructure to reduce spend.',
  },
  {
    icon: ShieldCheck,
    title: 'Security Automation',
    description: 'Enforce security policies, run automated scans, and maintain compliance. Integrate with security tools for continuous protection.',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-agentic-secondary">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display text-agentic-text">
            Powerful Features for{' '}
            <span className="text-agentic-primary">Modern DevOps</span>
          </h2>
          <p className="text-xl text-agentic-text/80 max-w-2xl mx-auto font-sans">
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
                className="glass-effect p-8 flex flex-col h-full group"
              >
                <div className="w-14 h-14 rounded-lg bg-agentic-surface border border-agentic-text/10 flex items-center justify-center mb-6 group-hover:border-agentic-primary/30 transition-colors">
                  <Icon className="w-6 h-6 text-agentic-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-agentic-text font-display">
                  {feature.title}
                </h3>
                <p className="text-agentic-text/80 leading-relaxed font-sans mt-auto">
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

