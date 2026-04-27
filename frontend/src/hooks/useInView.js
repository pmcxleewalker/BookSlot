import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight in-view hook using IntersectionObserver.
 * Returns [ref, hasBeenInView] — once true, stays true (we never re-hide).
 * SSR-safe: returns true if IntersectionObserver is unavailable.
 */
export const useInView = (options = { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      }
    }, options);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
};

/**
 * requestAnimationFrame tween from 0 → target.
 * Only starts when `active` is true, runs once, then clamps at target.
 * Uses easeOutQuint for a premium decelerating feel.
 */
export const useCountUp = (target, { active = true, duration = 1400 } = {}) => {
  const [value, setValue] = useState(active ? 0 : target);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (hasAnimated.current) {
      // Re-target instantly after first tween — keeps slider updates snappy.
      setValue(target);
      return;
    }
    hasAnimated.current = true;
    const start = performance.now();
    const from = 0;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 5);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // After first animation finishes, sync instantly when the target changes
  // (e.g. user moves a slider).
  useEffect(() => {
    if (hasAnimated.current) setValue(target);
  }, [target]);

  return value;
};
