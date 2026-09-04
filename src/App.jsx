import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InvitationEntrance } from "./components/InvitationEntrance.jsx";
import { LanguageSwitcher, QuranVerse } from "./components/LocalizedControls.jsx";
import { OrientalFrame } from "./components/WeddingIllustrations.jsx";
import { useScrollReveal } from "./hooks/useScrollReveal.js";
import { getInitialLanguage, translations } from "./i18n.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faCalendarDays,
  faClock,
  faGift,
  faMapLocationDot,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import "@fontsource/bodoni-moda/latin-400.css";
import "@fontsource/bodoni-moda/latin-500.css";
import "@fontsource/bodoni-moda/latin-600.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/allura/latin-400.css";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-600.css";

const WEDDING_DATE = new Date("2026-12-26T18:00:00-06:00");
const assetPath = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

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

function Countdown({ copy }) {
  const [remaining, setRemaining] = useState(getCountdown);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getCountdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!remaining) {
    return <p className="countdown-finished">{copy.finished}</p>;
  }

  return (
    <div className="countdown-grid" aria-label={copy.aria}>
      {[remaining.days, remaining.hours, remaining.minutes, remaining.seconds].map((value, index) => {
        const label = copy.units[index];
        return <div className="countdown-item" key={label}><strong>{value}</strong><span>{label}</span></div>;
      })}
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

function CalendarMenu({ copy, language, onClose }) {
  const googleUrl = useMemo(() => {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: copy.eventTitle,
      dates: "20261227T000000Z/20261227T060000Z",
      details: copy.eventDescription,
      location: "Holiday Inn San Salvador, Urb. y Blvd. Santa Elena y Calle Pital Oriente, San Salvador",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [copy]);

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//Gabriela y Murad//Wedding//${language.toUpperCase()}`,
      "BEGIN:VEVENT",
      "UID:gabriela-murad-20261226@example.local",
      "DTSTAMP:20260829T000000Z",
      "DTSTART:20261227T000000Z",
      "DTEND:20261227T060000Z",
      `SUMMARY:${copy.eventTitle}`,
      "LOCATION:Holiday Inn San Salvador\, Urb. y Blvd. Santa Elena y Calle Pital Oriente",
      `DESCRIPTION:${copy.eventDescription}`,
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
    <div className="calendar-menu" role="menu" aria-label={copy.calendarOptions}>
      <a href={googleUrl} target="_blank" rel="noreferrer" role="menuitem">Google Calendar</a>
      <button type="button" onClick={downloadIcs} role="menuitem">Apple / iCal / Outlook</button>
    </div>
  );
}

function RSVP({ copy }) {
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
      setNotice(copy.selectGuests);
      return;
    }
    const response = { answer: nextAnswer, guests, message, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey, JSON.stringify(response));
    setAnswer(nextAnswer);
    setNotice(nextAnswer === "asistire" ? copy.thanks : copy.missYou);
  };

  return (
    <section className="rsvp-section" id="rsvp" aria-labelledby="rsvp-title">
      <img className="rsvp-seal" src={assetPath("gold-wax-seal-gm.png")} alt="" />
      <SectionHeading eyebrow={copy.eyebrow} light>
        <span id="rsvp-title">{copy.title}</span>
      </SectionHeading>
      <p className="rsvp-deadline">{copy.deadline}</p>
      {answer && <div className="current-answer" role="status">{copy.current} <strong>{answer === "asistire" ? copy.attending : copy.notAttending}</strong></div>}
      <form className="rsvp-form" data-reveal onSubmit={(event) => event.preventDefault()}>
        <label>{copy.name}<input value={guest} disabled /></label>
        <label>
          {copy.guests}
          <select value={guests} onChange={(event) => setGuests(event.target.value)}>
            <option value="">{copy.choose}</option>
            {copy.guestOptions.map((option, index) => <option key={option} value={index + 1}>{option}</option>)}
          </select>
        </label>
        <label>
          {copy.message}
          <textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} />
          <span className="character-count">{message.length}/500</span>
        </label>
        <div className="rsvp-actions">
          <button className="button button--gold" type="button" onClick={() => saveAnswer("asistire")}>{copy.attending}</button>
          <button className="button button--light" type="button" onClick={() => saveAnswer("no-asistire")}>{copy.notAttending}</button>
        </div>
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </form>
    </section>
  );
}

export function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const invitationRef = useRef(null);
  const heroTitleRef = useRef(null);
  const copy = translations[language];
  const openInvitation = useCallback(() => setInvitationOpen(true), []);
  useScrollReveal(invitationRef, invitationOpen, language);

  const changeLanguage = useCallback((nextLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("gm-language", nextLanguage);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLanguage);
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = copy.direction;
    document.title = copy.metaTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy.metaDescription);
  }, [copy, language]);

  useEffect(() => {
    if (!invitationOpen) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    heroTitleRef.current?.focus({ preventScroll: true });
  }, [invitationOpen]);

  return (
    <div className={`app-root${copy.direction === "rtl" ? " is-rtl" : ""}`} dir={copy.direction} style={{ "--paper-texture": `url("${assetPath("paper-texture.jpg")}")` }}>
      <LanguageSwitcher language={language} label={copy.languageLabel} onChange={changeLanguage} />
      {!invitationOpen ? <InvitationEntrance assetPath={assetPath} copy={copy} onOpen={openInvitation} /> : <>
      <main className="invitation-shell" ref={invitationRef}>
        <section className="hero" aria-labelledby="hero-title">
          <img src={assetPath("studio-gabriela-murat.jpg")} alt={copy.hero.alt} />
          <div className="hero-overlay" />
          <div className="hero-copy" data-reveal>
            <p className="hero-kicker">{copy.hero.kicker}</p>
            <h1 id="hero-title" ref={heroTitleRef} tabIndex={-1}>
              <span className="partner-name">{language === "ar" ? "غابرييلا" : "Gabriela"}</span>
              <span className="name-joiner">{language === "ar" ? " و " : " & "}</span>
              <span className="partner-name partner-name--bold">{language === "ar" ? "مراد" : "Murad"}</span>
            </h1>
            <p className="hero-date" dir="ltr">{copy.hero.date}</p>
          </div>
        </section>

        <section className="paper-section invitation-card" aria-labelledby="invitation-title">
          <div className="invitation-paper" style={{ "--envelope-paper": `url("${assetPath("envelope-verse-blank.png")}")` }}>
            <img className="envelope-image" src={assetPath("envelope-verse-blank.png")} alt={copy.invitation.envelopeAlt} />
            <div className="envelope-verse-overlay" data-reveal>
              <QuranVerse copy={copy.quran} />
            </div>
            <div className="invitation-copy" data-reveal>
              <h2 id="invitation-title">{copy.invitation.title}</h2>
              <p>{copy.invitation.message}</p>
              <time dateTime="2026-12-26">{copy.invitation.date}</time>
              <img className="invitation-rings" src={assetPath("gold-rings.webp")} alt="" />
            </div>
          </div>
        </section>

        <section className="countdown-section" aria-labelledby="countdown-title">
          <img src={assetPath("beach-gabriela-murat.jpg")} alt={copy.countdown.beachAlt} />
          <div className="countdown-veil" />
          <div className="countdown-content" data-reveal>
            <h2 id="countdown-title">{copy.countdown.title}</h2>
            <Countdown copy={copy.countdown} />
            <div className="countdown-calendar">
              <p>{copy.countdown.saveDate}</p>
              <h3>{copy.countdown.remember}</h3>
              <div className="calendar-control">
                <button className="button button--calendar" type="button" aria-expanded={calendarOpen} onClick={() => setCalendarOpen((open) => !open)}>
                  <FontAwesomeIcon icon={faCalendarDays} /> {copy.countdown.addCalendar}
                </button>
                {calendarOpen && <CalendarMenu copy={copy.countdown} language={language} onClose={() => setCalendarOpen(false)} />}
              </div>
            </div>
          </div>
        </section>

        <section className="paper-section story-section" aria-labelledby="story-title">
          <OrientalFrame />
          <SectionHeading eyebrow={copy.story.eyebrow}><span id="story-title">{copy.story.title}</span></SectionHeading>
          <div className="story-mark" aria-hidden="true">{copy.couple}</div>
          {copy.story.paragraphs.map((paragraph) => <p key={paragraph} data-reveal>{paragraph}</p>)}
        </section>

        <figure className="photo-break"><img src={assetPath("garden-gabriela-murat.jpg")} alt={copy.story.photoAlt} /></figure>

        <section className="paper-section details-section" aria-labelledby="details-title">
          <SectionHeading eyebrow={copy.details.eyebrow}><span id="details-title">{copy.details.title}</span></SectionHeading>
          <article className="venue-card" data-reveal>
            <p className="venue-label">{copy.details.reception}</p>
            <img className="hotel-illustration" src={assetPath("hotel-holiday-inn-line-art.png")} alt={copy.details.hotelAlt} />
            <p className="venue-time" dir="ltr"><FontAwesomeIcon icon={faClock} /> {copy.details.time}</p>
            <h3>{copy.venueName}</h3>
            <address>{copy.venueAddress}</address>
            <div className="venue-actions">
              <a className="button button--burgundy" href="https://www.google.com/maps/search/?api=1&query=Holiday+Inn+San+Salvador+Urb.+y+Blvd.+Santa+Elena+y+Calle+Pital+Oriente" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faMapLocationDot} /> Google Maps</a>
              <a className="button button--burgundy" href="https://www.waze.com/ul?q=Holiday%20Inn%20San%20Salvador%20Santa%20Elena&navigate=yes" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faRoute} /> Waze</a>
            </div>
          </article>
        </section>

        <section className="paper-section gift-section" aria-labelledby="gift-title">
          <FontAwesomeIcon className="gift-icon" icon={faGift} />
          <SectionHeading eyebrow={copy.gift.eyebrow}><span id="gift-title">{copy.gift.title}</span></SectionHeading>
          <p>{copy.gift.message}</p>
        </section>

        <RSVP copy={copy.rsvp} />

        <footer className="final-photo">
          <img src={assetPath("hero-gabriela-murat.jpg")} alt={copy.final.alt} />
          <div className="final-overlay" />
          <div className="final-copy" data-reveal>
            <p className="script">{language === "ar" ? "غابرييلا" : "Gabriela"} <span>{language === "ar" ? "و" : "&"}</span> <strong>{language === "ar" ? "مراد" : "Murad"}</strong></p>
            <p>{copy.final.message}</p>
          </div>
        </footer>
      </main>

      <div className="floating-actions">
        <button type="button" aria-label={copy.backToTop} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><FontAwesomeIcon icon={faArrowUp} /></button>
        <a href="#rsvp">RSVP</a>
      </div>
      </>}
    </div>
  );
}
