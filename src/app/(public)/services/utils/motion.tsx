'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const MotionContext = React.createContext(true);

const MOTION_PROPS = new Set([
  'initial', 'animate', 'exit', 'whileInView', 'whileHover', 'whileTap',
  'whileFocus', 'whileDrag', 'variants', 'transition', 'viewport', 'layout',
  'layoutId', 'layoutDependency', 'onAnimationStart', 'onAnimationComplete', 'onUpdate',
]);

function stripMotionProps(props: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_PROPS.has(k)));
}

const MButton = ({ children, ...props }: any) => {
  const contextAllowed = React.useContext(MotionContext);
  const reducedMotion = useReducedMotion();
  const motionAllowed = contextAllowed && !reducedMotion;
  // Always render motion.button so React's component tree stays consistent across SSR/CSR.
  return motionAllowed
    ? <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} {...props}>{children}</motion.button>
    : <motion.button {...stripMotionProps(props)}>{children}</motion.button>;
};

const MDiv = ({ children, ...props }: any) => {
  const contextAllowed = React.useContext(MotionContext);
  const reducedMotion = useReducedMotion();
  const motionAllowed = contextAllowed && !reducedMotion;
  // Always render motion.div so React's component tree stays consistent across SSR/CSR.
  return motionAllowed
    ? <motion.div {...props}>{children}</motion.div>
    : <motion.div {...stripMotionProps(props)}>{children}</motion.div>;
};

export const M = {
  button: MButton,
  div: MDiv,
};
