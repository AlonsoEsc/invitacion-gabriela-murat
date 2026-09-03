import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InvitationEntrance } from "./components/InvitationEntrance.jsx";
import { AgendaIllustration, DecorativeArcs, OrientalFrame } from "./components/WeddingIllustrations.jsx";
import { useScrollReveal } from "./hooks/useScrollReveal.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faCalendarDays,
  faClock,
  faEnvelope,
  faGift,
  faMapLocationDot,
  faRoute,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { faPinterestP } from "@fortawesome/free-brands-svg-icons";
import "@fontsource/bodoni-moda/latin-400.css";
import "@fontsource/bodoni-moda/latin-500.css";
import "@fontsource/bodoni-moda/latin-600.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/allura/latin-400.css";

const WEDDING_DATE = new Date("2026-12-26T18:00:00-06:00");
const assetPath = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

const agenda = [
  { time: "6:00 p.m.", label: "Cóctel de bienvenida", illustration: "cocktail" },
  { time: "7:00 p.m.", label: "Gran entrada y brindis", illustration: "toast" },
  { time: "7:30 p.m.", label: "Banquete", illustration: "dinner" },
  { time: "8:30 p.m.", label: "¡A bailar!", illustration: "music" },
  { time: "10:00 p.m.", label: "Snack nocturno", illustration: "snack" },
  { time: "11:00 p.m.", label: "Despedida y buena música", illustration: "farewell" },
];

function getCountdown() {
  const difference = WEDDING_DATE.getTime() - Date.now();
  if (difference <= 0) return null;
  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference / 3_600_000) % 24),
    minutes: Math.floor((difference / 60_000) % 60),
    seconds: Math.floor((difference / 1_000) % 60),
  };
}

function Countdown() {
  const [remaining, setRemaining] = useState(getCountdown);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getCountdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!remaining) {
    return <p className="countdown-finished">¡Hoy celebramos nuestro gran día!</p>;
  }

  return (
    <div className="countdown-grid" aria-label="Cuenta regresiva para la boda">
      {[
        [remaining.days, "Días"],
        [remaining.hours, "Horas"],
        [remaining.minutes, "Minutos"],
        [remaining.seconds, "Segundos"],
      ].map(([value, label]) => (
        <div className="countdown-item" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ eyebrow, children, light = false }) {
  return (
    <header className={`section-heading${light ? " section-heading--light" : ""}`} data-reveal>
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{children}</h2>
      <span aria-hidden="true" />
    </header>
  );
}

function CalendarMenu({ onClose }) {
  const googleUrl = useMemo(() => {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Boda de Gabriela y Murad",
      dates: "20261227T000000Z/20261227T060000Z",
      details: "Acompáñanos a celebrar nuestro matrimonio.",
      location: "Holiday Inn San Salvador, Urb. y Blvd. Santa Elena y Calle Pital Oriente, San Salvador",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, []);

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gabriela y Murad//Boda//ES",
      "BEGIN:VEVENT",
      "UID:gabriela-murad-20261226@example.local",
      "DTSTAMP:20260829T000000Z",
      "DTSTART:20261227T000000Z",
      "DTEND:20261227T060000Z",
      "SUMMARY:Boda de Gabriela y Murad",
      "LOCATION:Holiday Inn San Salvador\, Urb. y Blvd. Santa Elena y Calle Pital Oriente",
      "DESCRIPTION:Acompáñanos a celebrar nuestro matrimonio.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    link.download = "boda-gabriela-murad.ics";
    link.click();
    URL.revokeObjectURL(link.href);
    onClose();
  };

  return (
    <div className="calendar-menu" role="menu" aria-label="Opciones de calendario">
      <a href={googleUrl} target="_blank" rel="noreferrer" role="menuitem">Google Calendar</a>
      <button type="button" onClick={downloadIcs} role="menuitem">Apple / iCal / Outlook</button>
    </div>
  );
}

function GiftModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar información de regalo">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <FontAwesomeIcon className="modal-envelope" icon={faEnvelope} />
        <h3 id="gift-modal-title">Detalles de cariño</h3>
        <p>La información bancaria se mostrará aquí de manera discreta cuando sea confirmada por Gabriela y Murad.</p>
        <p className="modal-note">Por ahora, tu presencia y tus buenos deseos son el regalo más importante.</p>
      </section>
    </div>
  );
}

function RSVP() {
  const params = new URLSearchParams(window.location.search);
  const guest = params.get("guest") || "Co Weddings";
  const storageKey = `gm-rsvp-${guest}`;
  const [guests, setGuests] = useState("");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setAnswer(parsed.answer || "");
      setGuests(parsed.guests || "");
      setMessage(parsed.message || "");
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const saveAnswer = (nextAnswer) => {
    if (nextAnswer === "asistire" && !guests) {
      setNotice("Selecciona cuántos invitados asistirán.");
      return;
    }
    const response = { answer: nextAnswer, guests, message, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey, JSON.stringify(response));
    setAnswer(nextAnswer);
    setNotice(nextAnswer === "asistire" ? "¡Gracias! Tu asistencia quedó confirmada." : "Tu respuesta quedó registrada. Los extrañaremos.");
  };

  return (
    <section className="rsvp-section" id="rsvp" aria-labelledby="rsvp-title">
      <img className="rsvp-seal" src={assetPath("gold-wax-seal-gm.png")} alt="" />
      <SectionHeading eyebrow="¿Nos acompañas?" light>
        <span id="rsvp-title">Confirma tu asistencia</span>
      </SectionHeading>
      <p className="rsvp-deadline">Por favor confirma tu asistencia antes del 1 de diciembre de 2026.</p>
      {answer && <div className="current-answer" role="status">Respuesta actual: <strong>{answer === "asistire" ? "Asistiré" : "No asistiré"}</strong></div>}
      <form className="rsvp-form" data-reveal onSubmit={(event) => event.preventDefault()}>
        <label>Nombre<input value={guest} disabled /></label>
        <label>
          Número de invitados
          <select value={guests} onChange={(event) => setGuests(event.target.value)}>
            <option value="">Selecciona una opción</option>
            <option value="1">1 invitado</option>
            <option value="2">2 invitados</option>
            <option value="3">3 invitados</option>
            <option value="4">4 invitados</option>
          </select>
        </label>
        <label>
          Déjanos un mensaje de cariño o la canción que te hará bailar toda la noche
          <textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} />
          <span className="character-count">{message.length}/500</span>
        </label>
        <div className="rsvp-actions">
          <button className="button button--gold" type="button" onClick={() => saveAnswer("asistire")}>Asistiré</button>
          <button className="button button--light" type="button" onClick={() => saveAnswer("no-asistire")}>No asistiré</button>
        </div>
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </form>
    </section>
  );
}

export function App() {
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const invitationRef = useRef(null);
  const heroTitleRef = useRef(null);
  const openInvitation = useCallback(() => setInvitationOpen(true), []);
  useScrollReveal(invitationRef, invitationOpen);

  useEffect(() => {
    if (!invitationOpen) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    heroTitleRef.current?.focus({ preventScroll: true });
  }, [invitationOpen]);

  return (
    <div className="app-root" style={{ "--paper-texture": `url("${assetPath("paper-texture.jpg")}")` }}>
      {!invitationOpen ? <InvitationEntrance assetPath={assetPath} onOpen={openInvitation} /> : <>
      <main className="invitation-shell" ref={invitationRef}>
        <section className="hero" aria-labelledby="hero-title">
          <img src={assetPath("studio-gabriela-murat.jpg")} alt="Retrato de Gabriela y Murad" />
          <div className="hero-overlay" />
          <div className="hero-copy" data-reveal>
            <p className="hero-kicker">Nuestra boda</p>
            <h1 id="hero-title" ref={heroTitleRef} tabIndex={-1}>
              <span className="partner-name">Gabriela</span>
              <span className="name-joiner"> &amp; </span>
              <span className="partner-name partner-name--bold">Murad</span>
            </h1>
            <p className="hero-date">26 · 12 · 2026</p>
          </div>
        </section>

        <section className="paper-section invitation-card" aria-labelledby="invitation-title">
          <div className="invitation-paper" style={{ "--envelope-paper": `url("${assetPath("envelope-gm-serif.png")}")` }}>
            <img className="envelope-image" src={assetPath("envelope-gm-serif.png")} alt="Sobre de boda color vino con sello G y M" />
            <div className="invitation-copy" data-reveal>
              <img className="invitation-monogram" src={assetPath("monogram-gm-burgundy.png")} alt="" />
              <h2 id="invitation-title">Gabriela y Murad</h2>
              <p>Con gran alegría, los invitamos a acompañarnos a celebrar nuestro matrimonio.</p>
              <time dateTime="2026-12-26">26 de diciembre de 2026</time>
              <img className="invitation-rings" src={assetPath("gold-rings.webp")} alt="" />
            </div>
          </div>
        </section>

        <section className="countdown-section" aria-labelledby="countdown-title">
          <img src={assetPath("beach-gabriela-murat.jpg")} alt="Gabriela y Murad caminando juntos frente al mar" />
          <div className="countdown-veil" />
          <div className="countdown-content" data-reveal>
            <h2 id="countdown-title">Sólo faltan...</h2>
            <Countdown />
            <div className="countdown-calendar">
              <p>Guarda la fecha</p>
              <h3>Recordar boda</h3>
              <div className="calendar-control">
                <button className="button button--calendar" type="button" aria-expanded={calendarOpen} onClick={() => setCalendarOpen((open) => !open)}>
                  <FontAwesomeIcon icon={faCalendarDays} /> Agregar al calendario
                </button>
                {calendarOpen && <CalendarMenu onClose={() => setCalendarOpen(false)} />}
              </div>
            </div>
          </div>
        </section>

        <section className="paper-section story-section" aria-labelledby="story-title">
          <OrientalFrame />
          <SectionHeading eyebrow="Nuestra historia"><span id="story-title">El gran sí</span></SectionHeading>
          <div className="story-mark" aria-hidden="true">Gabriela &amp; Murad</div>
          <p data-reveal>Caminamos años a la distancia, pero desde el primer día sentimos esa conexión eléctrica e innegable. El amor no sabe de mapas: unió a El Salvador y Palestina, al otro lado del mundo, para demostrarnos que el destino ya nos tenía escritos.</p>
          <p data-reveal>En diciembre de 2025 dijimos un “sí” lleno de profunda alegría. Hoy abrimos el corazón para compartir con ustedes esta nueva historia, convencidos de que nuestro mayor regalo ha sido encontrarnos y unir nuestras vidas para siempre.</p>
        </section>

        <figure className="photo-break"><img src={assetPath("garden-gabriela-murat.jpg")} alt="Gabriela y Murad tomados de la mano en un jardín tropical" /></figure>

        <section className="paper-section details-section" aria-labelledby="details-title">
          <SectionHeading eyebrow="Celebremos juntos"><span id="details-title">Detalles de la boda</span></SectionHeading>
          <article className="venue-card" data-reveal>
            <p className="venue-label">Recepción</p>
            <img className="hotel-illustration" src={assetPath("hotel-holiday-inn-line-art.png")} alt="Ilustración del Hotel Holiday Inn San Salvador" />
            <p className="venue-time"><FontAwesomeIcon icon={faClock} /> 6:00 p.m.</p>
            <h3>Hotel Holiday Inn</h3>
            <address>Urb. y Blvd. Santa Elena y Calle Pital Oriente, San Salvador, 1502, El Salvador</address>
            <div className="venue-actions">
              <a className="button button--burgundy" href="https://www.google.com/maps/search/?api=1&query=Holiday+Inn+San+Salvador+Urb.+y+Blvd.+Santa+Elena+y+Calle+Pital+Oriente" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faMapLocationDot} /> Google Maps</a>
              <a className="button button--burgundy" href="https://www.waze.com/ul?q=Holiday%20Inn%20San%20Salvador%20Santa%20Elena&navigate=yes" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faRoute} /> Waze</a>
            </div>
          </article>
        </section>

        <section className="paper-section agenda-section" aria-labelledby="agenda-title">
          <DecorativeArcs />
          <SectionHeading eyebrow="Nuestro gran día"><span id="agenda-title">Agenda de la boda</span></SectionHeading>
          <ol className="timeline">
            {agenda.map((item) => <li key={item.time} data-reveal><div className="timeline-item"><div className="timeline-icon"><AgendaIllustration kind={item.illustration} /></div><time>{item.time}</time><p>{item.label}</p></div></li>)}
          </ol>
        </section>

        <section className="dress-section" aria-labelledby="dress-title">
          <DecorativeArcs />
          <SectionHeading eyebrow="Vestimenta formal"><span id="dress-title">Dress code</span></SectionHeading>
          <div className="dress-illustration-wrap" data-reveal>
            <img
              className="dress-illustration"
              src={assetPath("dress-code-formal-line-art.png")}
              alt="Ilustración dorada de vestido formal y traje"
            />
          </div>
          <p>Les pedimos amablemente evitar el color blanco y sus derivados —marfil, perla y hueso—, ya que están reservados especialmente para la novia.</p>
          <a className="button button--burgundy" href="https://www.pinterest.com/search/pins/?q=vestimenta%20formal%20boda" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faPinterestP} /> Mira algunas sugerencias aquí</a>
        </section>

        <section className="paper-section gift-section" aria-labelledby="gift-title">
          <FontAwesomeIcon className="gift-icon" icon={faGift} />
          <SectionHeading eyebrow="Detalles de cariño"><span id="gift-title">Sugerencia de regalo</span></SectionHeading>
          <p>Su compañía es lo más valioso para nosotros. Para quienes deseen hacernos un presente, ponemos a su disposición nuestro buzón de sobres para ayudarnos a construir nuestro hogar.</p>
          <button className="envelope-button" type="button" onClick={() => setGiftOpen(true)}><FontAwesomeIcon icon={faEnvelope} /> Ver información del sobre</button>
        </section>

        <RSVP />

        <footer className="final-photo">
          <img src={assetPath("hero-gabriela-murat.jpg")} alt="Gabriela y Murad juntos en un jardín" />
          <div className="final-overlay" />
          <div className="final-copy" data-reveal>
            <p className="script">Gabriela <span>&amp;</span> <strong>Murad</strong></p>
            <p>¡Te esperamos!</p>
          </div>
        </footer>
      </main>

      <div className="floating-actions">
        <button type="button" aria-label="Volver arriba" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><FontAwesomeIcon icon={faArrowUp} /></button>
        <a href="#rsvp">RSVP</a>
      </div>
      {giftOpen && <GiftModal onClose={() => setGiftOpen(false)} />}
      </>}
    </div>
  );
}
