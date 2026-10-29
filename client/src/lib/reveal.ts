import { useEffect } from 'react';

/**
 * Scroll-reveal: any element with `data-reveal` fades/rises in the first time it enters the viewport.
 * Styles: data-reveal (rise) | "left" | "right" | "zoom" | "fade". Delay via the CSS variable `--d`.
 * Elements added later (lazy pages, async data) are picked up automatically.
 */
export function useScrollReveal() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = (el: Element) => el.classList.add('is-revealed');

    if (reduce || !('IntersectionObserver' in window)) {
      prepareStagger();
      document.querySelectorAll('[data-reveal]').forEach(show);
      const mo = new MutationObserver(() => {
        prepareStagger();
        document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(show);
      });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    // Tracked per effect run (not on the element), so a remount re-observes everything.
    const watched = new WeakSet<Element>();
    const scan = () => {
      prepareStagger();
      document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety net for fast flicks: anything already scrolled past is revealed too,
    // so nothing is left invisible above the viewport.
    let raf = 0;
    const sweep = () => {
      raf = 0;
      const vh = window.innerHeight;
      document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => {
        if (el.getBoundingClientRect().top < vh * 0.92) {
          show(el);
          io.unobserve(el);
        }
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sweep);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
}

/**
 * `data-stagger` on a container (e.g. a card grid): each direct child reveals in turn.
 * Optional value = animation style for the children, e.g. data-stagger="zoom".
 */
function prepareStagger() {
  document.querySelectorAll<HTMLElement>('[data-stagger]:not([data-stagger-ready])').forEach((parent) => {
    parent.setAttribute('data-stagger-ready', '');
    const style = parent.dataset.stagger || '';
    Array.from(parent.children).forEach((child, i) => {
      const el = child as HTMLElement;
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', style);
      el.style.setProperty('--d', `${i * 110}ms`);
    });
  });
}

/**
 * Gentle parallax: elements with `data-parallax="0.12"` drift at a fraction of the scroll speed.
 * Off for reduced-motion users and on small screens.
 */
export function useParallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (window.innerWidth < 1024) return;
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const factor = Number(el.dataset.parallax) || 0.1;
        const offset = (r.top + r.height / 2 - vh / 2) * -factor;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
}
