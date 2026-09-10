function readRow(line) {
  const cells = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

export function parseInvitationCsv(source) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("El archivo no contiene invitados.");

  const headers = readRow(lines[0]).map((header) => header.toLowerCase());
  const required = ["name", "maxattendees"];
  for (const header of required) {
    if (!headers.includes(header)) throw new Error(`Falta la columna obligatoria: ${header}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = readRow(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const maxAttendees = Number(row.maxattendees);
    if (!row.name) throw new Error(`Falta el nombre en la fila ${rowIndex + 2}.`);
    if (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 3) {
      throw new Error(`Los cupos de la fila ${rowIndex + 2} deben estar entre 1 y 3.`);
    }
    return {
      displayName: row.name,
      contactEmail: row.email || "",
      maxAttendees,
      defaultLanguage: row.language || "es",
      group: row.group || "",
      notes: row.notes || "",
    };
  });
}

export function toCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const headers = ["Invitado", "Correo", "Estado", "Asistentes", "Nombres", "Mensaje", "Correo de confirmacion", "Fecha de respuesta"];
  const lines = rows.map((row) => [
    row.displayName,
    row.contactEmail,
    row.status || "pending",
    row.attendingCount || 0,
    (row.attendeeNames || []).join(" | "),
    row.message,
    row.emailStatus?.overall || "not-sent",
    row.respondedAt ? new Date(row.respondedAt).toISOString() : "",
  ].map(escape).join(","));
  return [headers.map(escape).join(","), ...lines].join("\r\n");
}
