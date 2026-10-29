import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/** The single smooth-scroll instance for the public site (null on touch-only or reduced-motion devices). */
let lenis: Lenis | null = null;

export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out-expo: quick start, long soft landing
      smoothWheel: true,
      // Phones/tablets keep native momentum scrolling, which already feels right.
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis?.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
}

/** Jump to the top instantly (used on page change). */
export function scrollToTopInstant() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo({ top: 0, behavior: 'instant' });
}

/** Smooth scroll to the top (e.g. between booking-form steps). */
export function scrollToTopSmooth() {
  if (lenis) lenis.scrollTo(0, { duration: 0.9 });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Smoothly bring an element into view, leaving room for the fixed navbar. */
export function smoothScrollTo(el: HTMLElement) {
  // force: works even if a dialog paused scrolling a moment ago.
  if (lenis) {
    // Pages load lazily: re-measure so the scroll limit includes the newly rendered content.
    lenis.resize();
    lenis.scrollTo(el, { offset: -96, duration: 1.2, force: true });
  }
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Freeze page scrolling while a menu or dialog is open. */
export function setScrollLocked(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : '';
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}
