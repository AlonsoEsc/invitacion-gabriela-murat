import { useEffect } from "react";

export function useScrollReveal(rootRef, enabled) {
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    const configure = () => {
      observer?.disconnect();
      root.classList.remove("motion-ready");
      if (preference.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.dataset.visible = "true";
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
      root.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
      root.classList.add("motion-ready");
    };
    configure();
    preference.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", configure);
      root.classList.remove("motion-ready");
    };
  }, [rootRef, enabled]);
}
