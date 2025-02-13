'use client';

import React, { useState, useEffect, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  /**
   * Interval in seconds before switching to the next text.
   */
  interval?: number;
  /**
   * Framer Motion transition object (e.g. `{ duration: 0.3 }`)
   */
  transition?: {
    duration?: number;
    ease?: string | number[];
  };
  /**
   * Called on each text change.
   */
  onIndexChange?: (index: number) => void;
  /**
   * Whether to loop through the text.
   */
  trigger?: boolean;
  /**
   * AnimatePresence `mode` prop, e.g. 'sync', 'popLayout', or 'wait'.
   */
  mode?: 'sync' | 'popLayout' | 'wait';
};

const defaultVariants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
};

export function TextLoop({
  children,
  className,
  interval = 1.9,
  transition = { duration: 0.3 },
  onIndexChange,
  trigger = true,
  mode = 'wait', // or 'popLayout', whichever you prefer
}: TextLoopProps) {
  const items = Children.toArray(children);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!trigger) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % items.length;
        onIndexChange?.(nextIndex);
        return nextIndex;
      });
    }, interval * 1000);

    return () => clearInterval(timer);
  }, [interval, trigger, items.length, onIndexChange]);

  return (
    <span className={className}>
      <AnimatePresence initial={false} mode={mode}>
        {/* We give each text a unique key so AnimatePresence knows how to handle enter/exit */}
        <motion.span
          key={currentIndex}
          variants={defaultVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          style={{ display: 'inline-block' }}
        >
          {items[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}