from typing import Optional

from sqlalchemy.orm import Session

from . import models


def registrar_historial(
    db: Session,
    reserva_id: int,
    estado_anterior: Optional[models.EstadoReserva],
    estado_nuevo: models.EstadoReserva,
    detalle: Optional[str] = None,
) -> models.ReservaHistorial:
    """Agrega el evento a la sesión. NO hace commit (lo hace quien la llama)."""
    evento = models.ReservaHistorial(
        reserva_id=reserva_id,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        detalle=detalle[:250] if detalle else None,
    )
    db.add(evento)
    return evento