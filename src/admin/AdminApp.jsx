import { useCallback, useEffect, useMemo, useState } from "react";
import { adminEventsUrl, getAdminSession, listInvitations, loginAdmin, logoutAdmin, retryRsvpEmail } from "../services/rsvpService.js";
import { toCsv } from "./csv.js";
import "./admin.css";

function download(filename, contents, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(date) : "-";
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await loginAdmin(email.trim(), password);
      onLogin(result.user);
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

export function AdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const loadInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listInvitations();
      setInvitations(result.invitations);
    } catch {
      setNotice("No fue posible leer la lista. Verifica la conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    getAdminSession().then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!user) {
      setInvitations([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    loadInvitations();
    const events = new EventSource(adminEventsUrl, { withCredentials: true });
    events.addEventListener("invitations", loadInvitations);
    const timer = window.setInterval(loadInvitations, 30000);
    return () => {
      events.close();
      window.clearInterval(timer);
    };
  }, [loadInvitations, user]);

  const metrics = useMemo(() => {
    const attending = invitations.filter((item) => item.status === "attending");
    const declined = invitations.filter((item) => item.status === "declined");
    const pending = invitations.filter((item) => !item.status || item.status === "pending");
    const people = attending.reduce((sum, item) => sum + (item.attendingCount || 0), 0);
    return { attending: attending.length, declined: declined.length, pending: pending.length, people };
  }, [invitations]);

  const visibleRows = useMemo(() => invitations.filter((item) => {
    const status = item.status || "pending";
    const matchesFilter = filter === "all" || status === filter || (filter === "email-error" && ["failed", "partial"].includes(item.emailStatus?.overall));
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${item.displayName} ${item.contactEmail || ""} ${(item.attendeeNames || []).join(" ")}`.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  }), [filter, invitations, search]);

  const exportResponses = () => download("confirmaciones-gabriela-murad.csv", toCsv(invitations), "text/csv;charset=utf-8");

  const copyPublicLink = async () => {
    const configured = import.meta.env.VITE_PUBLIC_SITE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`;
    const url = new URL(configured);
    url.search = "";
    url.hash = "";
    await navigator.clipboard.writeText(url.toString());
    setNotice("Enlace único de la invitación copiado.");
  };

  const retryEmail = async (invitationId) => {
    setNotice("Reintentando el envío de correo...");
    try {
      const result = await retryRsvpEmail(invitationId);
      setNotice(result.emailStatus === "sent" ? "Los correos se enviaron correctamente." : "La respuesta está guardada, pero uno de los correos sigue pendiente.");
      await loadInvitations();
    } catch {
      setNotice("No fue posible reenviar los correos. Revisa la configuración del proveedor.");
    }
  };

  if (!authReady) return <main className="admin-loading">Cargando panel...</main>;
  if (!user) return <AdminLogin onLogin={setUser} />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="admin-eyebrow">Gabriela &amp; Murad</span><h1>Control de invitados</h1><p>Confirmaciones actualizadas en tiempo real.</p></div>
        <div className="admin-header-actions"><a href={import.meta.env.BASE_URL}>Ver invitación</a><button type="button" onClick={async () => { await logoutAdmin(); setUser(null); }}>Cerrar sesión</button></div>
      </header>

      <section className="metrics-grid" aria-label="Resumen de confirmaciones">
        <Metric label="Personas confirmadas" value={metrics.people} detail={`${metrics.attending} respuestas aceptadas`} />
        <Metric label="Confirmaciones aceptadas" value={metrics.attending} />
        <Metric label="Pendientes" value={metrics.pending} />
        <Metric label="No asistirán" value={metrics.declined} />
      </section>

      <section className="admin-toolbar">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar invitado, correo o acompañante" aria-label="Buscar invitados" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos</option><option value="pending">Pendientes</option><option value="attending">Asistirán</option><option value="declined">No asistirán</option><option value="email-error">Correo con error</option>
        </select>
        <button type="button" onClick={copyPublicLink}>Copiar enlace único</button>
        <button type="button" onClick={exportResponses} disabled={!invitations.length}>Exportar respuestas</button>
      </section>

      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-table-card">
        <div className="admin-section-title"><div><span>Lista general</span><h2>{visibleRows.length} respuestas</h2></div><small>Actualización automática</small></div>
        {loading ? <p className="admin-empty">Cargando invitados...</p> : visibleRows.length === 0 ? <p className="admin-empty">No hay invitados que coincidan con el filtro.</p> : (
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Invitado</th><th>Respuesta</th><th>Total</th><th>Asistentes y acompañantes</th><th>Confirmación</th><th>Actualización</th><th>Acciones</th></tr></thead>
              <tbody>{visibleRows.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.displayName}</strong><small>{item.contactEmail || "Sin correo"}</small></td>
                  <td><span className={`status status--${item.status || "pending"}`}>{item.status === "attending" ? "Asistirá" : item.status === "declined" ? "No asistirá" : "Pendiente"}</span></td>
                  <td>{item.attendingCount || 0}</td>
                  <td>{item.attendeeNames?.length ? item.attendeeNames.join(", ") : "-"}{item.message && <small>Mensaje: {item.message}</small>}</td>
                  <td><span className={`email-status email-status--${item.emailStatus?.overall || "pending"}`}>{item.emailStatus?.overall === "sent" ? "Enviado" : item.emailStatus?.overall === "failed" ? "Error" : item.emailStatus?.overall === "partial" ? "Parcial" : "Pendiente"}</span></td>
                  <td>{formatDate(item.respondedAt)}</td>
                  <td><div className="row-actions">{["failed", "partial"].includes(item.emailStatus?.overall) ? <button type="button" onClick={() => retryEmail(item.id)}>Reenviar correo</button> : <span>-</span>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
