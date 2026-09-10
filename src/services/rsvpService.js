const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "request-failed");
  return data;
}

export const getInvitation = (token) => request(`/invitations/public/${encodeURIComponent(token)}`);

export const submitRsvp = (payload) => request("/rsvp", {
  method: "POST",
  body: JSON.stringify({
    ...payload,
    submissionId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }),
});

export const submitPublicRsvp = (payload) => request("/rsvp/public", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const loginAdmin = (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const logoutAdmin = () => request("/auth/logout", { method: "POST" });
export const getAdminSession = () => request("/auth/me");
export const listInvitations = () => request("/admin/invitations");
export const createInvitation = (payload) => request("/admin/invitations", { method: "POST", body: JSON.stringify(payload) });
export const updateInvitation = (invitationId, payload) => request(`/admin/invitations/${encodeURIComponent(invitationId)}`, { method: "PATCH", body: JSON.stringify(payload) });
export const importInvitations = (rows) => request("/admin/invitations/import", { method: "POST", body: JSON.stringify({ rows }) });
export const retryRsvpEmail = (invitationId) => request(`/admin/invitations/${encodeURIComponent(invitationId)}/retry-email`, { method: "POST" });
export const adminEventsUrl = `${API_BASE}/admin/events`;
