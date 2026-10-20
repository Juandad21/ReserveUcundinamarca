from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/notificaciones", tags=["notificaciones"])


@router.get("/usuario/{usuario_id}", response_model=list[schemas.NotificacionOut])
def listar_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Usuario, usuario_id):
        raise HTTPException(404, "Usuario no encontrado")
    return (
        db.query(models.Notificacion)
        .filter(models.Notificacion.usuario_id == usuario_id)
        .order_by(models.Notificacion.fecha.desc(), models.Notificacion.id.desc())
        .all()
    )


@router.patch("/{notificacion_id}/leida", response_model=schemas.NotificacionOut)
def marcar_leida(notificacion_id: int, db: Session = Depends(get_db)):
    notif = db.get(models.Notificacion, notificacion_id)
    if not notif:
        raise HTTPException(404, "Notificación no encontrada")
    notif.leida = True
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/usuario/{usuario_id}/leer-todas")
def marcar_todas_leidas(usuario_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Usuario, usuario_id):
        raise HTTPException(404, "Usuario no encontrado")
    actualizadas = (
        db.query(models.Notificacion)
        .filter(models.Notificacion.usuario_id == usuario_id, models.Notificacion.leida == False)  # noqa: E712
        .update({"leida": True})
    )
    db.commit()
    return {"actualizadas": actualizadas}