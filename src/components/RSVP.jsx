import { useMemo, useState } from "react";
import { submitPublicRsvp } from "../services/rsvpService.js";

const assetPath = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

function SectionHeading({ eyebrow, children }) {
  return (
    <header className="section-heading section-heading--light" data-reveal>
      <p>{eyebrow}</p>
      <h2>{children}</h2>
      <span aria-hidden="true" />
    </header>
  );
}

export function RSVP({ copy, language }) {
  const initialGuest = useMemo(() => new URLSearchParams(window.location.search).get("guest") || "", []);
  const [guestName, setGuestName] = useState(initialGuest);
  const [status, setStatus] = useState("");
  const [count, setCount] = useState("");
  const [attendeeNames, setAttendeeNames] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maximumGuests = 3;
  const countOptions = useMemo(() => Array.from({ length: maximumGuests }, (_, index) => index + 1), [maximumGuests]);

  const changeCount = (value) => {
    setCount(value);
    const nextCount = Number(value) || 0;
    setAttendeeNames((current) => Array.from({ length: nextCount }, (_, index) => current[index] || (index === 0 ? guestName : "")));
  };

  const changeAttendee = (index, value) => {
    setAttendeeNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  const save = async (nextStatus) => {
    setNotice("");
    const attending = nextStatus === "attending";
    const normalizedNames = attending ? [guestName.trim(), ...attendeeNames.slice(1).map((name) => name.trim())] : [];

    if (!guestName.trim()) {
      setNotice(copy.nameRequired);
      return;
    }

    if (attending && (!count || normalizedNames.length !== Number(count) || normalizedNames.some((name) => !name))) {
      setNotice(copy.completeAttendees);
      return;
    }
    if (!email.trim()) {
      setNotice(copy.emailRequired);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        language,
        status: nextStatus,
        attendingCount: attending ? Number(count) : 0,
        attendeeNames: attending ? normalizedNames : [],
        guestEmail: email.trim() || undefined,
        message: message.trim(),
      };
      const result = await submitPublicRsvp({
        ...payload,
        displayName: guestName.trim(),
        responseId: window.localStorage.getItem("gm-public-rsvp-id") || undefined,
      });
      if (result.responseId) window.localStorage.setItem("gm-public-rsvp-id", result.responseId);
      setStatus(nextStatus);
      setNotice(result.emailStatus === "sent" ? copy.savedAndEmailed : copy.savedEmailPending);
    } catch (error) {
      const messages = {
        "deadline-passed": copy.deadlinePassed,
        "not-found": copy.invalidLink,
        "resource-exhausted": copy.tryLater,
      };
      setNotice(messages[error.message] || copy.saveError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rsvp-section" id="rsvp" aria-labelledby="rsvp-title">
      <img className="rsvp-seal" src={assetPath("gold-wax-seal-gm.png")} alt="" />
      <SectionHeading eyebrow={copy.eyebrow}>
        <span id="rsvp-title">{copy.title}</span>
      </SectionHeading>
      <p className="rsvp-deadline">{copy.deadline}</p>

      <>
          {status && (
            <div className="current-answer" role="status">
              {copy.current} <strong>{status === "attending" ? copy.attending : copy.notAttending}</strong>
            </div>
          )}
          <form className="rsvp-form" data-reveal onSubmit={(event) => event.preventDefault()}>
            <label>
              {copy.name}
              <input value={guestName} maxLength={100} onChange={(event) => setGuestName(event.target.value)} disabled={submitting} placeholder={copy.namePlaceholder} required />
            </label>
            <label>
              {copy.guests}
              <select value={count} onChange={(event) => changeCount(event.target.value)} disabled={submitting}>
                <option value="">{copy.choose}</option>
                {countOptions.map((option) => <option key={option} value={option}>{copy.peopleOption.replace("{count}", option)}</option>)}
              </select>
            </label>

            {attendeeNames.slice(1).map((name, listIndex) => {
              const index = listIndex + 1;
              return <label key={index}>
                {copy.companionName.replace("{number}", index)}
                <input value={name} maxLength={100} onChange={(event) => changeAttendee(index, event.target.value)} disabled={submitting} required />
              </label>
            })}

            <label>
              {copy.email}
              <input type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required />
              <small>{copy.emailHelp}</small>
            </label>

            <label>
              {copy.message}
              <textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} disabled={submitting} />
              <span className="character-count">{message.length}/500</span>
            </label>
            <div className="rsvp-actions">
              <button className="button button--gold" type="button" disabled={submitting} onClick={() => save("attending")}>{submitting ? copy.saving : copy.attending}</button>
              <button className="button button--light" type="button" disabled={submitting} onClick={() => save("declined")}>{copy.notAttending}</button>
            </div>
            {notice && <p className="form-notice" role="status">{notice}</p>}
          </form>
      </>
    </section>
  );
}
