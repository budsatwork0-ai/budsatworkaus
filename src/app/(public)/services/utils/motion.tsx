import React from 'react';
import { motion } from 'framer-motion';

// SSR-safe motion toggle
export const WITH_MOTION = (() => {
  try {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();

export const MotionContext = React.createContext(true);

const MButton = ({ children, ...props }: any) => {
  const motionAllowed = React.useContext(MotionContext) && WITH_MOTION;
  return motionAllowed ? (
    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} {...props}>
      {children}
    </motion.button>
  ) : (
    <button {...props}>{children}</button>
  );
};

const MDiv = ({ children, ...props }: any) => {
  const motionAllowed = React.useContext(MotionContext) && WITH_MOTION;
  return motionAllowed ? <motion.div {...props}>{children}</motion.div> : <div {...props}>{children}</div>;
};

export const M = {
  button: MButton,
  div: MDiv,
};
