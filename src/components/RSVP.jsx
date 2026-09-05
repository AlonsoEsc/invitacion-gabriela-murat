import { useEffect, useMemo, useState } from "react";
import { submitRsvp } from "../services/rsvpService.js";

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

function StateMessage({ title, message }) {
  return (
    <div className="rsvp-state" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export function RSVP({ copy, language, token, invitationState }) {
  const invitation = invitationState.invitation;
  const [status, setStatus] = useState("");
  const [count, setCount] = useState("");
  const [attendeeNames, setAttendeeNames] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!invitation) return;
    setStatus(invitation.response?.status || "");
    setCount(invitation.response?.attendingCount ? String(invitation.response.attendingCount) : "");
    setAttendeeNames(invitation.response?.attendeeNames || []);
    setMessage(invitation.response?.message || "");
  }, [invitation]);

  const countOptions = useMemo(
    () => Array.from({ length: invitation?.maxAttendees || 0 }, (_, index) => index + 1),
    [invitation?.maxAttendees],
  );

  const changeCount = (value) => {
    setCount(value);
    const nextCount = Number(value) || 0;
    setAttendeeNames((current) => Array.from({ length: nextCount }, (_, index) => current[index] || (index === 0 ? invitation.displayName : "")));
  };

  const changeAttendee = (index, value) => {
    setAttendeeNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  const save = async (nextStatus) => {
    setNotice("");
    const attending = nextStatus === "attending";
    const normalizedNames = attendeeNames.map((name) => name.trim());

    if (attending && (!count || normalizedNames.length !== Number(count) || normalizedNames.some((name) => !name))) {
      setNotice(copy.completeAttendees);
      return;
    }
    if (!invitation.hasContactEmail && !email.trim()) {
      setNotice(copy.emailRequired);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitRsvp({
        token,
        language,
        status: nextStatus,
        attendingCount: attending ? Number(count) : 0,
        attendeeNames: attending ? normalizedNames : [],
        guestEmail: email.trim() || undefined,
        message: message.trim(),
      });
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

      {invitationState.status === "loading" && <StateMessage title={copy.loadingTitle} message={copy.loading} />}
      {invitationState.status === "missing" && <StateMessage title={copy.personalLinkTitle} message={copy.personalLinkRequired} />}
      {invitationState.status === "not-found" && <StateMessage title={copy.invalidLinkTitle} message={copy.invalidLink} />}
      {invitationState.status === "unavailable" && <StateMessage title={copy.setupTitle} message={copy.setupPending} />}
      {invitationState.status === "error" && <StateMessage title={copy.errorTitle} message={copy.loadError} />}

      {invitationState.status === "ready" && (
        <>
          <div className="guest-welcome" data-reveal>
            <span>{copy.invitationFor}</span>
            <strong>{invitation.displayName}</strong>
            <small>{copy.availablePlaces.replace("{count}", invitation.maxAttendees)}</small>
          </div>
          {status && (
            <div className="current-answer" role="status">
              {copy.current} <strong>{status === "attending" ? copy.attending : copy.notAttending}</strong>
            </div>
          )}
          <form className="rsvp-form" data-reveal onSubmit={(event) => event.preventDefault()}>
            <label>
              {copy.name}
              <input value={invitation.displayName} disabled />
            </label>
            <label>
              {copy.guests}
              <select value={count} onChange={(event) => changeCount(event.target.value)} disabled={submitting}>
                <option value="">{copy.choose}</option>
                {countOptions.map((option) => <option key={option} value={option}>{copy.peopleOption.replace("{count}", option)}</option>)}
              </select>
            </label>

            {attendeeNames.map((name, index) => (
              <label key={index}>
                {index === 0 ? copy.primaryAttendee : copy.companionName.replace("{number}", index)}
                <input value={name} maxLength={100} onChange={(event) => changeAttendee(index, event.target.value)} disabled={submitting} />
              </label>
            ))}

            {!invitation.hasContactEmail && (
              <label>
                {copy.email}
                <input type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} disabled={submitting} />
                <small>{copy.emailHelp}</small>
              </label>
            )}

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
      )}
    </section>
  );
}
