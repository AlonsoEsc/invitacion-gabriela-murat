import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { isFirebaseConfigured } from "../lib/firebase.js";
import { getFirebaseAdminServices } from "../lib/firebaseAdmin.js";
import { createInvitation, importInvitations, retryRsvpEmail, updateInvitation } from "../services/rsvpService.js";
import { parseInvitationCsv, toCsv } from "./csv.js";
import "./admin.css";

const EMPTY_FORM = { displayName: "", contactEmail: "", maxAttendees: 1, defaultLanguage: "es", group: "", notes: "" };

function invitationUrl(invitation) {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  const base = configured || `${window.location.origin}${import.meta.env.BASE_URL}`;
  const url = new URL(base);
  url.searchParams.set("inv", invitation.token);
  url.searchParams.set("lang", invitation.defaultLanguage || "es");
  return url.toString();
}

function download(filename, contents, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date ? new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(date) : "-";
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(getFirebaseAdminServices().auth, email.trim(), password);
    } catch {
      setError("No fue posible iniciar sesión. Verifica el correo y la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <span className="admin-eyebrow">Gabriela &amp; Murad</span>
        <h1>Panel de invitados</h1>
        <p>Acceso privado para administrar invitaciones y confirmaciones.</p>
        <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <a href={import.meta.env.BASE_URL}>Volver a la invitación</a>
      </form>
    </main>
  );
}

function Metric({ label, value, detail }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function InvitationForm({ invitation, onClose }) {
  const editing = Boolean(invitation);
  const [form, setForm] = useState(() => editing ? {
    displayName: invitation.displayName || "",
    contactEmail: invitation.contactEmail || "",
    maxAttendees: invitation.maxAttendees || 1,
    defaultLanguage: invitation.defaultLanguage || "es",
    group: invitation.group || "",
    notes: invitation.notes || "",
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setResult("");
    try {
      const payload = { ...form, maxAttendees: Number(form.maxAttendees) };
      if (editing) {
        await updateInvitation(invitation.id, payload);
        setResult("Cambios guardados correctamente.");
      } else {
        const response = await createInvitation(payload);
        setResult(response.shareUrl);
        setForm(EMPTY_FORM);
      }
    } catch {
      setResult(`No se pudo ${editing ? "actualizar" : "crear"} la invitación. Revisa los datos e intenta nuevamente.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-form-card">
      <div className="admin-section-title"><div><span>{editing ? "Datos del invitado" : "Nueva invitación"}</span><h2>{editing ? "Editar invitación" : "Agregar invitado"}</h2></div><button type="button" onClick={onClose}>Cerrar</button></div>
      <form className="admin-invitation-form" onSubmit={submit}>
        <label>Invitado o familia<input value={form.displayName} onChange={(event) => change("displayName", event.target.value)} maxLength={100} required /></label>
        <label>Correo para confirmación<input type="email" value={form.contactEmail} onChange={(event) => change("contactEmail", event.target.value)} maxLength={254} /></label>
        <label>Cupos permitidos<input type="number" min="1" max="20" value={form.maxAttendees} onChange={(event) => change("maxAttendees", event.target.value)} required /></label>
        <label>Idioma<select value={form.defaultLanguage} onChange={(event) => change("defaultLanguage", event.target.value)}><option value="es">Español</option><option value="en">English</option><option value="ar">العربية</option></select></label>
        <label>Grupo<input value={form.group} onChange={(event) => change("group", event.target.value)} placeholder="Familia, amigos, trabajo..." maxLength={80} /></label>
        <label className="admin-form-wide">Notas internas<textarea value={form.notes} onChange={(event) => change("notes", event.target.value)} maxLength={500} /></label>
        <button className="admin-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear enlace"}</button>
      </form>
      {result && <p className="admin-result" role="status">{result}</p>}
    </section>
  );
}

export function AdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    return onAuthStateChanged(getFirebaseAdminServices().auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setInvitations([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const invitationsQuery = query(collection(getFirebaseAdminServices().db, "invitations"), orderBy("createdAt", "desc"));
    return onSnapshot(invitationsQuery, (snapshot) => {
      setInvitations(snapshot.docs.map((item) => {
        const data = item.data();
        return { id: item.id, ...data, shareUrl: invitationUrl(data) };
      }));
      setLoading(false);
    }, () => {
      setNotice("No fue posible leer la lista. Verifica que tu usuario tenga permisos de administrador.");
      setLoading(false);
    });
  }, [user]);

  const metrics = useMemo(() => {
    const attending = invitations.filter((item) => item.status === "attending");
    const declined = invitations.filter((item) => item.status === "declined");
    const pending = invitations.filter((item) => !item.status || item.status === "pending");
    const people = attending.reduce((sum, item) => sum + (item.attendingCount || 0), 0);
    const capacity = invitations.reduce((sum, item) => sum + (item.maxAttendees || 0), 0);
    return { attending: attending.length, declined: declined.length, pending: pending.length, people, capacity };
  }, [invitations]);

  const visibleRows = useMemo(() => invitations.filter((item) => {
    const status = item.status || "pending";
    const matchesFilter = filter === "all" || status === filter || (filter === "email-error" && ["failed", "partial"].includes(item.emailStatus?.overall));
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${item.displayName} ${item.contactEmail || ""} ${item.group || ""}`.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  }), [filter, invitations, search]);

  const copyLink = async (url) => {
    await navigator.clipboard.writeText(url);
    setNotice("Enlace copiado.");
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("Procesando archivo...");
    try {
      const rows = parseInvitationCsv(await file.text());
      const result = await importInvitations(rows);
      const csv = ["name,email,maxAttendees,language,group,notes,link", ...result.created.map((item) => [item.displayName, item.contactEmail || "", item.maxAttendees, item.defaultLanguage, item.group || "", item.notes || "", item.shareUrl].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\r\n");
      download("enlaces-invitados.csv", csv, "text/csv;charset=utf-8");
      setNotice(`${result.created.length} enlaces creados y descargados.`);
    } catch (error) {
      setNotice(error.message || "No se pudo importar el archivo.");
    } finally {
      event.target.value = "";
    }
  };

  const exportResponses = () => download("confirmaciones-gabriela-murad.csv", toCsv(invitations), "text/csv;charset=utf-8");

  const retryEmail = async (invitationId) => {
    setNotice("Reintentando el envío de correo...");
    try {
      const result = await retryRsvpEmail(invitationId);
      setNotice(result.emailStatus === "sent" ? "Los correos se enviaron correctamente." : "La respuesta está guardada, pero uno de los correos sigue pendiente.");
    } catch {
      setNotice("No fue posible reenviar los correos. Revisa la configuración del proveedor.");
    }
  };

  if (!authReady) return <main className="admin-loading">Cargando panel...</main>;
  if (!isFirebaseConfigured) return <main className="admin-loading"><h1>Configuración pendiente</h1><p>Agrega las variables de Firebase para habilitar el panel.</p></main>;
  if (!user) return <AdminLogin />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="admin-eyebrow">Gabriela &amp; Murad</span><h1>Control de invitados</h1><p>Confirmaciones actualizadas en tiempo real.</p></div>
        <div className="admin-header-actions"><a href={import.meta.env.BASE_URL}>Ver invitación</a><button type="button" onClick={() => signOut(getFirebaseAdminServices().auth)}>Cerrar sesión</button></div>
      </header>

      <section className="metrics-grid" aria-label="Resumen de confirmaciones">
        <Metric label="Personas confirmadas" value={metrics.people} detail={`de ${metrics.capacity} cupos registrados`} />
        <Metric label="Invitaciones aceptadas" value={metrics.attending} />
        <Metric label="Pendientes" value={metrics.pending} />
        <Metric label="No asistirán" value={metrics.declined} />
      </section>

      <section className="admin-toolbar">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar invitado, correo o grupo" aria-label="Buscar invitados" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos</option><option value="pending">Pendientes</option><option value="attending">Asistirán</option><option value="declined">No asistirán</option><option value="email-error">Correo con error</option>
        </select>
        <button type="button" onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo invitado</button>
        <label className="admin-file-button">Importar CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
        <button type="button" onClick={exportResponses} disabled={!invitations.length}>Exportar respuestas</button>
      </section>

      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {showForm && <InvitationForm invitation={editing} onClose={() => { setShowForm(false); setEditing(null); }} />}

      <section className="admin-table-card">
        <div className="admin-section-title"><div><span>Lista general</span><h2>{visibleRows.length} invitaciones</h2></div><small>Actualización automática</small></div>
        {loading ? <p className="admin-empty">Cargando invitados...</p> : visibleRows.length === 0 ? <p className="admin-empty">No hay invitados que coincidan con el filtro.</p> : (
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Invitado</th><th>Cupos</th><th>Respuesta</th><th>Asistentes</th><th>Acompañantes</th><th>Correo</th><th>Actualización</th><th>Acciones</th></tr></thead>
              <tbody>{visibleRows.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.displayName}</strong><small>{item.contactEmail || "Sin correo"}{item.group ? ` · ${item.group}` : ""}</small></td>
                  <td>{item.maxAttendees}</td>
                  <td><span className={`status status--${item.status || "pending"}`}>{item.status === "attending" ? "Asistirá" : item.status === "declined" ? "No asistirá" : "Pendiente"}</span></td>
                  <td>{item.attendingCount || 0}</td>
                  <td>{item.attendeeNames?.length ? item.attendeeNames.join(", ") : "-"}{item.message && <small>Mensaje: {item.message}</small>}</td>
                  <td><span className={`email-status email-status--${item.emailStatus?.overall || "pending"}`}>{item.emailStatus?.overall === "sent" ? "Enviado" : item.emailStatus?.overall === "failed" ? "Error" : item.emailStatus?.overall === "partial" ? "Parcial" : "Pendiente"}</span></td>
                  <td>{formatDate(item.respondedAt)}</td>
                  <td><div className="row-actions"><button type="button" onClick={() => copyLink(item.shareUrl)}>Copiar enlace</button><button type="button" onClick={() => { setEditing(item); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>{["failed", "partial"].includes(item.emailStatus?.overall) && <button type="button" onClick={() => retryEmail(item.id)}>Reenviar correo</button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
