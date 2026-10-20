from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

# Horario de operación asumido para calcular la ocupación (6:00 a 22:00).
HORAS_POR_DIA = 16


def _horas(inicio, fin) -> float:
    return (datetime.combine(date.min, fin) - datetime.combine(date.min, inicio)).total_seconds() / 3600


@router.get("/resumen", response_model=schemas.ReporteResumen)
def resumen(
    desde: date | None = None,
    hasta: date | None = None,
    tipo: models.TipoEspacio | None = None,
    db: Session = Depends(get_db),
):
    hoy = date.today()
    desde = desde or hoy - timedelta(days=30)
    hasta = hasta or hoy + timedelta(days=30)
    if desde > hasta:
        raise HTTPException(400, "'desde' no puede ser posterior a 'hasta'")

    # Se cuentan las reservas del rango que no están canceladas.
    filtros = [
        models.Reserva.fecha >= desde,
        models.Reserva.fecha <= hasta,
        models.Reserva.estado != models.EstadoReserva.cancelada,
    ]
    if tipo:
        filtros.append(models.EspacioDeportivo.tipo == tipo)

    E = models.EspacioDeportivo

    # 1) Ranking: reservas por espacio (count + group_by)
    filas = (
        db.query(E.id, E.nombre, E.tipo, func.count(models.Reserva.id).label("total"))
        .join(models.Reserva, models.Reserva.espacio_id == E.id)
        .filter(*filtros)
        .group_by(E.id, E.nombre, E.tipo)
        .order_by(func.count(models.Reserva.id).desc(), E.nombre)
        .all()
    )
    ranking = [
        schemas.EspacioRanking(espacio_id=f.id, nombre=f.nombre, tipo=f.tipo, total_reservas=f.total)
        for f in filas
    ]

    # 2) Ingresos: suma de pagos aprobados, agrupados por día y luego por mes
    ingresos_dia = (
        db.query(models.Reserva.fecha, func.sum(models.Pago.monto))
        .join(models.Pago, models.Pago.reserva_id == models.Reserva.id)
        .join(E, E.id == models.Reserva.espacio_id)
        .filter(*filtros, models.Pago.estado == models.EstadoPago.aprobado)
        .group_by(models.Reserva.fecha)
        .all()
    )
    por_mes: dict[str, float] = defaultdict(float)
    for fecha, total in ingresos_dia:
        por_mes[fecha.strftime("%Y-%m")] += float(total or 0)
    ingresos_por_mes = [schemas.IngresoMes(mes=m, total=round(t, 2)) for m, t in sorted(por_mes.items())]

    # 3) Ocupación por tipo: horas reservadas / horas disponibles
    horas_tipo: dict = defaultdict(float)
    for inicio, fin, t in (
        db.query(models.Reserva.hora_inicio, models.Reserva.hora_fin, E.tipo)
        .join(E, E.id == models.Reserva.espacio_id)
        .filter(*filtros)
        .all()
    ):
        horas_tipo[t] += _horas(inicio, fin)

    q_espacios = db.query(E.tipo, func.count(E.id)).filter(E.estado != models.EstadoEspacio.inactivo)
    if tipo:
        q_espacios = q_espacios.filter(E.tipo == tipo)
    dias = (hasta - desde).days + 1

    ocupacion = []
    for t, n in q_espacios.group_by(E.tipo).all():
        disponibles = n * dias * HORAS_POR_DIA
        reservadas = horas_tipo.get(t, 0.0)
        pct = min(reservadas / disponibles * 100, 100) if disponibles else 0
        ocupacion.append(
            schemas.OcupacionTipo(
                tipo=t, espacios=n,
                horas_reservadas=round(reservadas, 2),
                horas_disponibles=float(disponibles),
                porcentaje=round(pct, 1),
            )
        )

    return schemas.ReporteResumen(
        desde=desde, hasta=hasta, tipo=tipo,
        total_reservas=sum(r.total_reservas for r in ranking),
        ingresos_totales=round(sum(i.total for i in ingresos_por_mes), 2),
        espacio_mas_reservado=ranking[0] if ranking else None,
        ranking_espacios=ranking,
        ingresos_por_mes=ingresos_por_mes,
        ocupacion_por_tipo=ocupacion,
    )