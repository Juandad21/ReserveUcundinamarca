from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel, ConfigDict

from .models import (
    RolUsuario, TipoEspacio, EstadoEspacio, EstadoReserva, MetodoPago, EstadoPago
)


# ============================================================
# Usuario
# ============================================================
class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: RolUsuario = RolUsuario.cliente


class UsuarioCreate(UsuarioBase):
    pass


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activo: bool
    fecha_registro: datetime


# ============================================================
# EspacioDeportivo — Requerimiento 1
# ============================================================
class EspacioBase(BaseModel):
    nombre: str
    tipo: TipoEspacio
    ubicacion: Optional[str] = None
    capacidad: int = 1
    precio_hora: float


class EspacioCreate(EspacioBase):
    pass


class EspacioUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoEspacio] = None
    ubicacion: Optional[str] = None
    capacidad: Optional[int] = None
    precio_hora: Optional[float] = None
    estado: Optional[EstadoEspacio] = None


class EspacioOut(EspacioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    estado: EstadoEspacio


# ============================================================
# Reserva — Requerimientos 2 y 3
# ============================================================
class ReservaBase(BaseModel):
    espacio_id: int
    usuario_id: int
    fecha: date
    hora_inicio: time
    hora_fin: time


class ReservaCreate(ReservaBase):
    pass


class ReservaCambiarEstado(BaseModel):
    estado: EstadoReserva


class ReservaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha: date
    hora_inicio: time
    hora_fin: time
    estado: EstadoReserva
    fecha_creacion: datetime
    espacio_id: int
    usuario_id: int


# ============================================================
# Pago — Requerimiento 4
# ============================================================
class PagoCreate(BaseModel):
    reserva_id: int
    metodo_pago: MetodoPago
    monto: float


class PagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reserva_id: int
    monto: float
    metodo_pago: MetodoPago
    estado: EstadoPago
    fecha_pago: datetime


class ReservaDetalleOut(ReservaOut):
    espacio: EspacioOut
    usuario: UsuarioOut
    pago: Optional[PagoOut] = None


class NotificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    usuario_id: int
    reserva_id: Optional[int] = None
    mensaje: str
    leida: bool
    fecha: datetime


class HistorialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reserva_id: int
    estado_anterior: Optional[EstadoReserva] = None
    estado_nuevo: EstadoReserva
    detalle: Optional[str] = None
    fecha: datetime


class ReservaReprogramar(BaseModel):
    fecha: date
    hora_inicio: time
    hora_fin: time

# ============================================================
# Reportes — Requerimiento 5
# ============================================================
class EspacioRanking(BaseModel):
    espacio_id: int
    nombre: str
    tipo: TipoEspacio
    total_reservas: int


class IngresoMes(BaseModel):
    mes: str  # formato "YYYY-MM"
    total: float


class OcupacionTipo(BaseModel):
    tipo: TipoEspacio
    espacios: int
    horas_reservadas: float
    horas_disponibles: float
    porcentaje: float


class ReporteResumen(BaseModel):
    desde: date
    hasta: date
    tipo: Optional[TipoEspacio] = None
    total_reservas: int
    ingresos_totales: float
    espacio_mas_reservado: Optional[EspacioRanking] = None
    ranking_espacios: list[EspacioRanking]
    ingresos_por_mes: list[IngresoMes]
    ocupacion_por_tipo: list[OcupacionTipo]