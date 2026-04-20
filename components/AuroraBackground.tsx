import React from 'react';
import { motion } from 'framer-motion';

const AuroraBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#030014] pointer-events-none flex items-center justify-center">
      {/* Gradient Orb 1 - Indigo */}
      <motion.div
        animate={{
          x: [0, 150, -100, 0],
          y: [0, -150, 100, 0],
          scale: [1, 1.2, 0.8, 1],
          rotate: [0, 90, 180, 360]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] blur-[120px]"
      />

      {/* Gradient Orb 2 - Purple */}
      <motion.div
        animate={{
          x: [0, -200, 150, 0],
          y: [0, 200, -150, 0],
          scale: [1, 1.5, 0.9, 1],
          rotate: [360, 180, 90, 0]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.15)_0%,transparent_70%)] blur-[120px]"
      />

      {/* Gradient Orb 3 - Pink/Magenta */}
      <motion.div
        animate={{
          x: [0, 100, -150, 0],
          y: [0, 100, -100, 0],
          scale: [1, 0.8, 1.3, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.12)_0%,transparent_70%)] blur-[120px]"
      />
      
      {/* Gradient Orb 4 - Cyan/Teal for depth */}
      <motion.div
        animate={{
          x: [0, -100, 50, 0],
          y: [0, -50, 150, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        className="absolute w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.1)_0%,transparent_70%)] blur-[100px]"
      />
    </div>
  );
};

export default AuroraBackground;
