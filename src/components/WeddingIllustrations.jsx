export function DecorativeArcs() {
  return (
    <svg className="decorative-arcs" viewBox="0 0 680 800" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
      <path d="M22 18 C158 142 -50 260 26 405 S110 642 14 780" />
      <path d="M658 18 C522 142 730 260 654 405 S570 642 666 780" />
      <path className="arc-secondary" d="M10 50 C136 166 -64 278 14 421 S90 652 2 750 M670 50 C544 166 744 278 666 421 S590 652 678 750" />
    </svg>
  );
}

export function OrientalFrame() {
  return (
    <svg className="oriental-frame" viewBox="0 0 680 800" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="gm-lattice" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M21 0L42 21L21 42L0 21ZM21 8L34 21L21 34L8 21ZM0 0L42 42M42 0L0 42" fill="none" stroke="#b1872f" strokeWidth=".65" />
        </pattern>
        <linearGradient id="gm-frame-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efd89a" />
          <stop offset=".48" stopColor="#b1872f" />
          <stop offset="1" stopColor="#f1d58b" />
        </linearGradient>
      </defs>
      <path className="oriental-lattice" d="M4 8H676V104H4ZM4 8H66V792H4ZM614 8H676V792H614Z" fill="url(#gm-lattice)" />
      <path className="oriental-arch oriental-arch--outer" d="M49 792V226C49 129 100 72 177 72H219C271 72 314 48 340 17C366 48 409 72 461 72H503C580 72 631 129 631 226V792" />
      <path className="oriental-arch oriental-arch--inner" d="M68 792V232C68 148 111 94 183 94H226C277 94 317 70 340 43C363 70 403 94 454 94H497C569 94 612 148 612 232V792" />
      <path className="oriental-detail" d="M49 226Q84 244 68 279M631 226Q596 244 612 279M49 220Q80 202 68 174M631 220Q600 202 612 174" />
      <g className="oriental-crescent" fill="url(#gm-frame-gold)" stroke="none">
        <path d="M340 105c-16 0-29 13-29 29s13 29 29 29c10 0 19-5 24-13-5 4-12 7-19 7-16 0-29-13-29-29 0-8 3-15 8-20 5-2 10-3 16-3Z" />
      </g>
      {[180, 260, 420, 500].map((x, index) => (
        <g className="oriental-lantern" key={x} transform={`translate(${x} ${index % 2 ? 119 : 101})`}>
          <path d="M0-95V-20M-5-20H5M-9-14H9L13 5L8 26H-8L-13 5Z" />
          <path d="M-8-4H8M-8 17H8M-6-14V26M6-14V26" />
          <circle cx="0" cy="4" r="3" fill="currentColor" stroke="none" />
        </g>
      ))}
    </svg>
  );
}

export function AgendaIllustration({ kind }) {
  const artwork = {
    dinner: <><circle cx="37" cy="36" r="20" /><circle cx="37" cy="36" r="15" /><path d="M8 11V29Q12 35 16 29V11 M12 11V61 M64 11V61 M64 11Q53 28 64 37" /></>,
    music: <><path d="M24 47V17L56 10V41 M24 25L56 18" /><ellipse cx="17" cy="49" rx="8" ry="5" transform="rotate(-20 17 49)" /><ellipse cx="49" cy="43" rx="8" ry="5" transform="rotate(-20 49 43)" /><path d="M43 54L45 59L50 60L45 62L43 67L41 62L36 60L41 59Z M12 12L14 17L19 19L14 21L12 26L10 21L5 19L10 17Z" /></>,
    snack: <><path d="M12 31Q16 10 36 10Q56 10 60 31Z M10 39H62 M13 45L22 50L33 46L44 50L59 44 M13 53Q14 63 23 63H50Q59 62 59 53Z M10 34H62 M23 20L26 18 M36 16L39 18 M47 22L50 20" /></>,
    farewell: <><path d="M10 37L19 20H51L61 37V56H10Z M18 35L24 24H46L53 35Z M10 44H61 M17 56V62H25V56 M47 56V62H55V56" /><circle cx="21" cy="46" r="4" /><circle cx="51" cy="46" r="4" /><path d="M29 50H43 M37 15C20 3 32-1 37 6C43-1 54 3 37 15Z" /></>,
  };
  return <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{artwork[kind]}</svg>;
}
