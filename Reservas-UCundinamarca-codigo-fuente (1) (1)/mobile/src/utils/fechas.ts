// El backend guarda las fechas en UTC pero las envía sin zona horaria
// ("2026-10-15T15:30:00"). Sin la "Z", JavaScript las interpreta como hora
// local y se ven corridas varias horas. Aquí se corrige.
export function parseFechaUtc(s: string): Date {
  const tieneZona = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(tieneZona ? s : s + "Z");
}

export function formatearFechaHora(s: string): string {
  return parseFechaUtc(s).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}