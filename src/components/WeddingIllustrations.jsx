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
