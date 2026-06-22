import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import rough from 'roughjs';

const facts = [
  {
    title: "AWS Elastic IPs",
    content: "EIPs are free to use... as long as they are attached to a running instance! If you have an unattached EIP, AWS will charge you by the hour."
  },
  {
    title: "Spot Instances",
    content: "You can save up to 90% on compute costs by using AWS Spot Instances for fault-tolerant, flexible workloads compared to On-Demand pricing."
  },
  {
    title: "Zombie Resources",
    content: "Unattached EBS volumes and outdated snapshots are 'zombie resources'. Deleting them is one of the quickest ways to instantly reduce your cloud bill."
  },
  {
    title: "S3 Intelligent-Tiering",
    content: "Not sure about access patterns? S3 Intelligent-Tiering automatically moves data between access tiers to optimize your storage costs without performance impact."
  },
  {
    title: "The Cost of Logging",
    content: "CloudWatch logs aren't free! Ingesting and storing massive amounts of uncompressed text logs can sometimes cost more than the compute generating them."
  }
];

const InsightsCard = () => {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (showCallout && containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'absolute right-2 top-0 w-8 h-8 animate-bounce overflow-visible');
      svg.setAttribute('fill', 'none');

      const rc = rough.svg(svg);
      
      const path1 = rc.path("M7 4c3 4 5 10 10 14", {
        stroke: '#3b82f6',
        strokeWidth: 2,
        roughness: 1.5,
        bowing: 1
      });
      
      const path2 = rc.path("M12 18h5v-5", {
        stroke: '#3b82f6',
        strokeWidth: 2,
        roughness: 1.5,
        bowing: 1
      });
      
      svg.appendChild(path1);
      svg.appendChild(path2);
      
      containerRef.current.appendChild(svg);
    }
  }, [showCallout]);

  useEffect(() => {
    let timeoutId;
    let isMounted = true;

    if (isCollapsed) {
      setShowCallout(false);
      return;
    }

    const runCycle = () => {
      const delay = Math.random() * 15000 + 10000; // 10s to 25s
      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        setShowCallout(true);

        const visibleDuration = Math.random() * 4000 + 6000; // 6s to 10s
        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          setShowCallout(false);
          runCycle();
        }, visibleDuration);

      }, delay);
    };

    runCycle();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isCollapsed]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isCollapsed) {
        setCurrentFactIndex((prev) => (prev + 1) % facts.length);
      }
    }, 20000); // cycle every 20 seconds

    return () => clearInterval(timer);
  }, [isCollapsed]);

  const nextFact = (e) => {
    e.stopPropagation(); // Prevent triggering collapse if clicked rapidly
    setCurrentFactIndex((prev) => (prev + 1) % facts.length);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="mt-8 relative group">
      <div className="flex items-center justify-between relative z-10">
        <button 
          onClick={toggleCollapse} 
          className="flex items-center gap-1.5 text-left focus:outline-none group/btn transition-opacity hover:opacity-70"
          title={isCollapsed ? "Expand Insights" : "Collapse Insights"}
        >
          <svg className="w-5 h-5 text-blue-600 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-brand font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-blue-600 tracking-wide">
              DevOps Insights
            </h3>
            <motion.svg 
              animate={{ rotate: isCollapsed ? 180 : 0 }} 
              transition={{ duration: 0.3 }}
              className="w-4 h-4 text-slate-400 group-hover/btn:text-blue-500 transition-colors" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <button 
              onClick={nextFact}
              className="text-[11px] uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 font-bold bg-transparent focus:outline-none"
            >
              Next 
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0, x: 100, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, x: 0, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, x: 100, marginTop: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFactIndex}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full"
              >
                <h4 className="text-sm font-brand font-bold text-slate-800 mb-1">
                  {facts[currentFactIndex].title}
                </h4>
                <p className="text-[13px] font-display text-slate-500 leading-relaxed">
                  {facts[currentFactIndex].content}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guide Agent Callout Container */}
      <div className="mt-8 h-16 relative">
        <AnimatePresence>
          {showCallout && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.4 }}
              className="absolute right-0 w-full flex flex-col items-end text-right pr-2"
            >
              <div className="opacity-80 hover:opacity-100 transition-opacity flex flex-col items-end w-full">
                <p className="text-[12px] font-display text-slate-500 leading-relaxed">
                  Ask the <span className="text-blue-600 font-semibold">Guide Agent</span>!
                </p>
                <div ref={containerRef} className="relative w-full h-10 mt-1">
                  {/* RoughJS SVG injected here */}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InsightsCard;
