import { motion } from 'framer-motion';

const ShaderGradient = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0B1120] isolate">
      {/* Background base */}
      <div className="absolute inset-0 bg-[#0B1120]"></div>

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-[30px] mix-blend-screen opacity-80"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.9) 0%, rgba(16,185,129,0) 60%)',
          top: '-20%',
          left: '-20%',
        }}
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute w-[900px] h-[900px] rounded-full blur-[40px] mix-blend-screen opacity-70"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.9) 0%, rgba(59,130,246,0) 60%)',
          bottom: '-10%',
          right: '-10%',
        }}
        animate={{
          x: [0, -150, 50, 0],
          y: [0, 100, -80, 0],
          scale: [1, 1.1, 1.3, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-[24px] mix-blend-screen opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.9) 0%, rgba(99,102,241,0) 60%)',
          top: '30%',
          left: '30%',
        }}
        animate={{
          x: [0, 200, -100, 0],
          y: [0, 50, 150, 0],
          scale: [1, 0.8, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Noise overlay for texture */}
      <div 
        className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      ></div>

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#0B1120] opacity-80 pointer-events-none" style={{ background: 'radial-gradient(circle, transparent 20%, #0B1120 120%)' }}></div>
    </div>
  );
};

export default ShaderGradient;
