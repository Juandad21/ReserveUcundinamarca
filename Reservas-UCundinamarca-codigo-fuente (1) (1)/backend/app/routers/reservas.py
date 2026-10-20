from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..notificaciones import crear_notificacion, MENSAJES_ESTADO
from ..historial_services import registrar_historial

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/reservas", tags=["reservas"])

# ------------------------------------------------------------
# Requerimiento 3 — máquina de estados de la Reserva
# ------------------------------------------------------------
TRANSICIONES_VALIDAS = {
    models.EstadoReserva.pendiente: {models.EstadoReserva.confirmada, models.EstadoReserva.cancelada},
    models.EstadoReserva.confirmada: {models.EstadoReserva.completada, models.EstadoReserva.cancelada},
    models.EstadoReserva.cancelada: set(),   # estado final
    models.EstadoReserva.completada: set(),  # estado final
}


def _cargar_relaciones(query):
    return query.options(
        joinedload(models.Reserva.espacio),
        joinedload(models.Reserva.usuario),
        joinedload(models.Reserva.pago),
    )


@router.get("/", response_model=list[schemas.ReservaDetalleOut])
def listar_reservas(estado: models.EstadoReserva | None = None, db: Session = Depends(get_db)):
    query = _cargar_relaciones(db.query(models.Reserva))
    if estado:
        query = query.filter(models.Reserva.estado == estado)
    return query.order_by(models.Reserva.fecha.desc(), models.Reserva.hora_inicio).all()


@router.get("/{reserva_id}", response_model=schemas.ReservaDetalleOut)
def obtener_reserva(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _cargar_relaciones(db.query(models.Reserva)).filter(models.Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    return reserva


# ------------------------------------------------------------
# Requerimiento 2 — creación de reservas, con validación de
# solapamiento de horario sobre el mismo espacio.
# ------------------------------------------------------------
def _validar_solapamiento(db: Session, espacio_id: int, fecha, hora_inicio, hora_fin,
                          excluir_reserva_id: int | None = None):
    """Lanza 400 si hay otra reserva activa (pendiente/confirmada) que se solape."""
    query = db.query(models.Reserva).filter(
        models.Reserva.espacio_id == espacio_id,
        models.Reserva.fecha == fecha,
        models.Reserva.estado.in_([models.EstadoReserva.pendiente, models.EstadoReserva.confirmada]),
    )
    if excluir_reserva_id is not None:
        query = query.filter(models.Reserva.id != excluir_reserva_id)

    for r in query.all():
        if hora_inicio < r.hora_fin and hora_fin > r.hora_inicio:
            raise HTTPException(
                400,
                f"El espacio ya está reservado de {r.hora_inicio} a {r.hora_fin} en esa fecha",
            )
        
@router.post("/", response_model=schemas.ReservaDetalleOut, status_code=201)
def crear_reserva(datos: schemas.ReservaCreate, db: Session = Depends(get_db)):
    espacio = db.get(models.EspacioDeportivo, datos.espacio_id)
    if not espacio:
        raise HTTPException(404, "Espacio no encontrado")
    if espacio.estado != models.EstadoEspacio.disponible:
        raise HTTPException(400, f"El espacio no está disponible (estado actual: {espacio.estado.value})")

    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(400, "La hora de fin debe ser posterior a la hora de inicio")

    usuario = db.get(models.Usuario, datos.usuario_id)
    if not usuario:
        raise HTTPException(404, "Usuario no encontrado")
    
    reservas_del_dia =_validar_solapamiento(db, datos.espacio_id, datos.fecha, datos.hora_inicio, datos.hora_fin)

    for r in reservas_del_dia:
        if datos.hora_inicio < r.hora_fin and datos.hora_fin > r.hora_inicio:
            raise HTTPException(
                400,
                f"El espacio ya está reservado de {r.hora_inicio} a {r.hora_fin} en esa fecha",
            )

    reserva = models.Reserva(**datos.model_dump(), estado=models.EstadoReserva.pendiente)
    db.add(reserva)
    db.flush()  
    registrar_historial(db, reserva.id, None, models.EstadoReserva.pendiente, "Reserva creada")
    crear_notificacion(db, reserva,f"Tu solicitud de reserva #{reserva.id} fue registrada y está pendiente de pago.",)
    db.commit()
    db.refresh(reserva)

    return _cargar_relaciones(db.query(models.Reserva)).filter(models.Reserva.id == reserva.id).first()


# ------------------------------------------------------------
# Requerimiento 3 — cambio de estado validado contra la máquina de estados
# ------------------------------------------------------------
@router.patch("/{reserva_id}/estado", response_model=schemas.ReservaDetalleOut)
def cambiar_estado_reserva(reserva_id: int, datos: schemas.ReservaCambiarEstado, db: Session = Depends(get_db)):
    reserva = db.get(models.Reserva, reserva_id)
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")

    if datos.estado not in TRANSICIONES_VALIDAS[reserva.estado]:
        raise HTTPException(
            400,
            f"Transición no válida: {reserva.estado.value} -> {datos.estado.value}",
        )

    # No se puede marcar como 'completada' una reserva sin pago aprobado.
    if datos.estado == models.EstadoReserva.completada:
        if not reserva.pago or reserva.pago.estado != models.EstadoPago.aprobado:
            raise HTTPException(400, "No se puede completar una reserva sin un pago aprobado")

    estado_anterior = reserva.estado
    reserva.estado = datos.estado
    registrar_historial(db, reserva.id, estado_anterior, datos.estado)

    plantilla = MENSAJES_ESTADO.get(datos.estado)
    if plantilla:
        crear_notificacion(db, reserva, plantilla.format(id=reserva.id))
    db.commit()
    db.refresh(reserva)

    return _cargar_relaciones(db.query(models.Reserva)).filter(models.Reserva.id == reserva.id).first()

@router.get("/{reserva_id}/historial", response_model=list[schemas.HistorialOut])
def obtener_historial(reserva_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Reserva, reserva_id):
        raise HTTPException(404, "Reserva no encontrada")
    return (
        db.query(models.ReservaHistorial)
        .filter(models.ReservaHistorial.reserva_id == reserva_id)
        .order_by(models.ReservaHistorial.fecha, models.ReservaHistorial.id)
        .all()
    )


@router.patch("/{reserva_id}/reprogramar", response_model=schemas.ReservaDetalleOut)
def reprogramar_reserva(reserva_id: int, datos: schemas.ReservaReprogramar, db: Session = Depends(get_db)):
    reserva = db.get(models.Reserva, reserva_id)
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    if reserva.estado != models.EstadoReserva.pendiente:
        raise HTTPException(400, "Solo se puede reprogramar una reserva en estado 'pendiente'")
    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(400, "La hora de fin debe ser posterior a la hora de inicio")
    if reserva.espacio.estado != models.EstadoEspacio.disponible:
        raise HTTPException(400, f"El espacio no está disponible (estado actual: {reserva.espacio.estado.value})")

    # Misma validación del Requerimiento 2, ignorando la propia reserva
    _validar_solapamiento(
        db, reserva.espacio_id, datos.fecha, datos.hora_inicio, datos.hora_fin,
        excluir_reserva_id=reserva.id,
    )

    anterior = f"{reserva.fecha} {reserva.hora_inicio:%H:%M}-{reserva.hora_fin:%H:%M}"
    nuevo = f"{datos.fecha} {datos.hora_inicio:%H:%M}-{datos.hora_fin:%H:%M}"

    reserva.fecha = datos.fecha
    reserva.hora_inicio = datos.hora_inicio
    reserva.hora_fin = datos.hora_fin

    registrar_historial(
        db, reserva.id, reserva.estado, reserva.estado,
        f"Reprogramada de {anterior} a {nuevo}",
    )
    crear_notificacion(db, reserva, f"Tu reserva #{reserva.id} fue reprogramada a {nuevo}.")

    db.commit()
    db.refresh(reserva)
    return _cargar_relaciones(db.query(models.Reserva)).filter(models.Reserva.id == reserva.id).first()
