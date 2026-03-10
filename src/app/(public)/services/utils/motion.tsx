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

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'whileInView', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'variants', 'transition', 'viewport', 'layout', 'layoutId', 'layoutDependency', 'onAnimationStart', 'onAnimationComplete', 'onUpdate']);

const MDiv = ({ children, ...props }: any) => {
  const motionAllowed = React.useContext(MotionContext) && WITH_MOTION;
  if (motionAllowed) return <motion.div {...props}>{children}</motion.div>;
  const domProps = Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_PROPS.has(k)));
  return <div {...domProps}>{children}</div>;
};

export const M = {
  button: MButton,
  div: MDiv,
};
