const EVENT = {
  es: { subject: "Confirmación de asistencia - Boda de Gabriela y Murad", greeting: "Gracias por confirmar", attending: "Asistirá", declined: "No asistirá", guests: "Personas registradas", message: "Mensaje", date: "26 de diciembre de 2026, 6:00 p.m.", venue: "Hotel Holiday Inn, San Salvador" },
  en: { subject: "RSVP confirmation - Gabriela and Murad's wedding", greeting: "Thank you for responding", attending: "Attending", declined: "Not attending", guests: "Registered attendees", message: "Message", date: "December 26, 2026, 6:00 p.m.", venue: "Hotel Holiday Inn, San Salvador" },
  ar: { subject: "تأكيد الحضور - زفاف غابرييلا ومراد", greeting: "شكرًا لتأكيد حضوركم", attending: "سيحضر", declined: "لن يحضر", guests: "الضيوف المسجلون", message: "الرسالة", date: "٢٦ ديسمبر ٢٠٢٦، الساعة ٦:٠٠ مساءً", venue: "فندق هوليداي إن، سان سلفادور" },
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function emailHtml(invitation, response, language = "es", forCouple = false) {
  const copy = EVENT[forCouple ? "es" : language] || EVENT.es;
  const status = response.status === "attending" ? copy.attending : copy.declined;
  const names = response.attendeeNames.length ? response.attendeeNames.map(escapeHtml).join("<br>") : "-";
  const direction = !forCouple && language === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html dir="${direction}"><body style="margin:0;background:#f7f1e7;color:#2f2020;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:30px 15px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #c6a15b"><tr><td style="background:#6f111d;color:#fff;padding:28px;text-align:center"><div style="color:#dfc98c;font-size:12px;letter-spacing:3px">GABRIELA &amp; MURAD</div><h1 style="font-family:Georgia,serif">${escapeHtml(copy.greeting)}</h1></td></tr><tr><td style="padding:30px"><h2 style="color:#6f111d;font-family:Georgia,serif">${escapeHtml(invitation.displayName)}</h2><p><strong>${escapeHtml(status)}</strong></p><p>${escapeHtml(copy.date)}<br>${escapeHtml(copy.venue)}</p><p><strong>${escapeHtml(copy.guests)}:</strong><br>${names}</p>${response.message ? `<p><strong>${escapeHtml(copy.message)}:</strong><br>${escapeHtml(response.message)}</p>` : ""}<p style="margin-top:28px;color:#756865;font-size:12px">Código de confirmación: ${escapeHtml(response.confirmationCode)}</p></td></tr></table></td></tr></table></body></html>`;
}

async function send(apiKey, from, payload) {
  if (!apiKey) throw new Error("email-provider-not-configured");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...payload }),
  });
  if (!result.ok) throw new Error(`email-provider-${result.status}`);
  return result.json();
}

export async function deliverRsvpEmails({ apiKey, from, replyTo, coupleEmails, invitation, response }) {
  const recipients = coupleEmails.split(",").map((email) => email.trim()).filter(Boolean);
  const reply = replyTo ? { reply_to: replyTo } : {};
  const couplePromise = recipients.length
    ? send(apiKey, from, { ...reply, to: recipients, subject: `RSVP: ${invitation.displayName} - ${response.status === "attending" ? "Asistirá" : "No asistirá"}`, html: emailHtml(invitation, response, "es", true) })
    : Promise.reject(new Error("couple-email-not-configured"));
  const guestRequired = Boolean(response.contactEmail);
  const guestPromise = guestRequired
    ? send(apiKey, from, { ...reply, to: [response.contactEmail], subject: (EVENT[response.language] || EVENT.es).subject, html: emailHtml(invitation, response, response.language) })
    : Promise.resolve({ skipped: true });
  const [couple, guest] = await Promise.allSettled([couplePromise, guestPromise]);
  const coupleSent = couple.status === "fulfilled";
  const guestSent = guest.status === "fulfilled";
  return {
    overall: coupleSent && (!guestRequired || guestSent) ? "sent" : coupleSent || guestSent ? "partial" : "failed",
    couple: coupleSent ? "sent" : "failed",
    guest: guestRequired ? (guestSent ? "sent" : "failed") : "not-requested",
    error: [couple, guest].filter((result) => result.status === "rejected").map((result) => result.reason?.message || "email-error").join(", ").slice(0, 300),
    lastAttemptAt: new Date(),
  };
}
