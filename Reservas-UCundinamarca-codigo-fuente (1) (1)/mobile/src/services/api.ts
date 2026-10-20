import axios from "axios";
import { Platform } from "react-native";

// En dispositivo físico / emulador Android, "localhost" no apunta al backend
// que corre en el computador del docente; ajustar API_URL según el entorno
// (ver README del proyecto móvil para las distintas opciones).
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000");

export const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// ============================================================
// Tipos
// ============================================================
export type RolUsuario = "cliente" | "administrador";
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  fecha_registro: string;
}

export type TipoEspacio =
  | "cancha_futbol"
  | "cancha_baloncesto"
  | "cancha_tenis"
  | "piscina"
  | "gimnasio";
export type EstadoEspacio = "disponible" | "mantenimiento" | "inactivo";
export interface Espacio {
  id: number;
  nombre: string;
  tipo: TipoEspacio;
  ubicacion?: string;
  capacidad: number;
  precio_hora: number;
  estado: EstadoEspacio;
}

export type EstadoReserva = "pendiente" | "confirmada" | "cancelada" | "completada";
export interface Reserva {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoReserva;
  fecha_creacion: string;
  espacio_id: number;
  usuario_id: number;
}
export type MetodoPago = "tarjeta" | "transferencia" | "efectivo";
export type EstadoPago = "pendiente" | "aprobado" | "rechazado";
export interface Pago {
  id: number;
  reserva_id: number;
  monto: number;
  metodo_pago: MetodoPago;
  estado: EstadoPago;
  fecha_pago: string;
}

export interface ReservaDetalle extends Reserva {
  espacio: Espacio;
  usuario: Usuario;
  pago?: Pago | null;
}

// ---- Reportes (Requerimiento 5) ----
export interface EspacioRanking {
  espacio_id: number;
  nombre: string;
  tipo: TipoEspacio;
  total_reservas: number;
}
export interface IngresoMes {
  mes: string; // "YYYY-MM"
  total: number;
}
export interface OcupacionTipo {
  tipo: TipoEspacio;
  espacios: number;
  horas_reservadas: number;
  horas_disponibles: number;
  porcentaje: number;
}
export interface ReporteResumen {
  desde: string;
  hasta: string;
  tipo: TipoEspacio | null;
  total_reservas: number;
  ingresos_totales: number;
  espacio_mas_reservado: EspacioRanking | null;
  ranking_espacios: EspacioRanking[];
  ingresos_por_mes: IngresoMes[];
  ocupacion_por_tipo: OcupacionTipo[];
}


export interface Notificacion {
  id: number;
  usuario_id: number;
  reserva_id: number | null;
  mensaje: string;
  leida: boolean;
  fecha: string;
}


export interface HistorialEvento {
  id: number;
  reserva_id: number;
  estado_anterior: EstadoReserva | null;
  estado_nuevo: EstadoReserva;
  detalle: string | null;
  fecha: string;
}
// ============================================================
// Funciones de la API
// ============================================================
export const espaciosApi = {
  listar: () => api.get<Espacio[]>("/api/espacios/").then((r) => r.data),
  crear: (data: { nombre: string; tipo: TipoEspacio; ubicacion?: string; capacidad: number; precio_hora: number }) =>
    api.post<Espacio>("/api/espacios/", data).then((r) => r.data),
  actualizar: (id: number, data: Partial<Espacio>) =>
    api.put<Espacio>(`/api/espacios/${id}`, data).then((r) => r.data),
  darDeBaja: (id: number) => api.delete(`/api/espacios/${id}`),
};

export const reservasApi = {
  listar: (estado?: EstadoReserva) =>
    api
      .get<ReservaDetalle[]>("/api/reservas/", { params: estado ? { estado } : {} })
      .then((r) => r.data),
  obtener: (id: number) => api.get<ReservaDetalle>(`/api/reservas/${id}`).then((r) => r.data),
  crear: (data: { espacio_id: number; usuario_id: number; fecha: string; hora_inicio: string; hora_fin: string }) =>
    api.post<ReservaDetalle>("/api/reservas/", data).then((r) => r.data),
  cambiarEstado: (id: number, estado: EstadoReserva) =>
    api.patch<ReservaDetalle>(`/api/reservas/${id}/estado`, { estado }).then((r) => r.data),
      historial: (id: number) =>
    api.get<HistorialEvento[]>(`/api/reservas/${id}/historial`).then((r) => r.data),
      reprogramar: (id: number, data: { fecha: string; hora_inicio: string; hora_fin: string }) =>
    api.patch<ReservaDetalle>(`/api/reservas/${id}/reprogramar`, data).then((r) => r.data),
};

export const pagosApi = {
  registrar: (data: { reserva_id: number; metodo_pago: MetodoPago; monto: number }) =>
    api.post<Pago>("/api/pagos/", data).then((r) => r.data),
};

export const usuariosApi = {
  listar: () => api.get<Usuario[]>("/api/usuarios/").then((r) => r.data),
  crear: (data: { nombre: string; email: string; rol: RolUsuario }) =>
    api.post<Usuario>("/api/usuarios/", data).then((r) => r.data),
};

export const reportesApi = {
  resumen: (params: { desde?: string; hasta?: string; tipo?: TipoEspacio }) =>
    api.get<ReporteResumen>("/api/reportes/resumen", { params }).then((r) => r.data),
};

export const notificacionesApi = {
  listar: (usuarioId: number) =>
    api.get<Notificacion[]>(`/api/notificaciones/usuario/${usuarioId}`).then((r) => r.data),
  marcarLeida: (id: number) =>
    api.patch<Notificacion>(`/api/notificaciones/${id}/leida`).then((r) => r.data),
  marcarTodasLeidas: (usuarioId: number) =>
    api.patch(`/api/notificaciones/usuario/${usuarioId}/leer-todas`).then((r) => r.data),
};