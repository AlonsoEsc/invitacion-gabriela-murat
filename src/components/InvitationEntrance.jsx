import { useEffect, useState } from "react";

export function InvitationEntrance({ assetPath, onOpen }) {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!opening) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(onOpen, reducedMotion ? 0 : 1400);
    return () => window.clearTimeout(timer);
  }, [opening, onOpen]);

  return (
    <main className={`invitation-entrance${opening ? " is-opening" : ""}`} aria-label="Invitación de Gabriela y Murat">
      <div className="entrance-envelope">
        <div className="entrance-letter" aria-hidden="true">
          <img src={assetPath("monogram-gm-burgundy.png")} alt="" />
          <span>Nos casamos</span>
        </div>
        <div className="envelope-fold envelope-fold--left" />
        <div className="envelope-fold envelope-fold--right" />
        <div className="envelope-fold envelope-fold--bottom" />
        <div className="envelope-flap" />
        <button className="entrance-seal" type="button" aria-label="Abrir invitación de Gabriela y Murat" disabled={opening} onClick={() => setOpening(true)}>
          <svg viewBox="434 871 252 252" aria-hidden="true" focusable="false">
            <image href={assetPath("envelope-gm-serif.png")} width="1122" height="1402" />
          </svg>
        </button>
      </div>
    </main>
  );
}
