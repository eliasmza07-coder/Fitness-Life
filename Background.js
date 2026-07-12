/* Interactive static background: the grain follows the pointer,
   and a short glitch burst fires on press. Shared by every page. */
(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  let raf = null;
  window.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const x = ((e.clientX / window.innerWidth) * 100).toFixed(1);
      const y = ((e.clientY / window.innerHeight) * 100).toFixed(1);
      document.documentElement.style.setProperty("--mx", x + "%");
      document.documentElement.style.setProperty("--my", y + "%");
      raf = null;
    });
  }, { passive: true });

  let glitchTimer = null;
  window.addEventListener("pointerdown", () => {
    document.body.classList.add("glitching");
    clearTimeout(glitchTimer);
    glitchTimer = setTimeout(() => document.body.classList.remove("glitching"), 180);
  });
})();
