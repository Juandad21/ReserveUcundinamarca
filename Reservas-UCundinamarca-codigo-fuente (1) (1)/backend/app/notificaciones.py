from sqlalchemy.orm import Session

from . import models

MENSAJES_ESTADO = {
    models.EstadoReserva.confirmada: "Tu reserva #{id} fue confirmada.",
    models.EstadoReserva.cancelada: "Tu reserva #{id} fue cancelada.",
    models.EstadoReserva.completada: "Tu reserva #{id} fue completada. ¡Gracias por usar el servicio!",
}


def crear_notificacion(db: Session, reserva: models.Reserva, mensaje: str) -> models.Notificacion:
    """Agrega la notificación a la sesión. NO hace commit: lo hace quien la llama,
    así el cambio de estado y la notificación se guardan en la misma transacción."""
    notif = models.Notificacion(
        usuario_id=reserva.usuario_id,
        reserva_id=reserva.id,
        mensaje=mensaje[:250],
    )
    db.add(notif)
    return notif