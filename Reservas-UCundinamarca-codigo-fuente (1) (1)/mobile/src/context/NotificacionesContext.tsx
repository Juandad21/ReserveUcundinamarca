import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { notificacionesApi, usuariosApi, Notificacion, Usuario } from "../services/api";

const INTERVALO_MS = 15000; // polling cada 15 segundos

interface NotificacionesCtx {
  usuarios: Usuario[];
  usuarioId: number | null;
  setUsuarioId: (id: number) => void;
  notificaciones: Notificacion[];
  noLeidas: number;
  recargar: () => Promise<void>;
  marcarLeida: (id: number) => Promise<void>;
  marcarTodasLeidas: () => Promise<void>;
}

const Ctx = createContext<NotificacionesCtx | null>(null);

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  // Como la app no tiene login, el "usuario activo" se elige en la pantalla de
  // notificaciones. Por defecto se toma el primero de la lista.
  useEffect(() => {
    usuariosApi
      .listar()
      .then((lista) => {
        setUsuarios(lista);
        setUsuarioId((actual) => actual ?? lista[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const recargar = useCallback(async () => {
    if (usuarioId == null) return;
    try {
      setNotificaciones(await notificacionesApi.listar(usuarioId));
    } catch {
      // error silencioso: el polling reintenta en el siguiente ciclo
    }
  }, [usuarioId]);

  // Polling. Al cambiar de usuario se limpia la lista y se reinicia el temporizador.
  useEffect(() => {
    if (usuarioId == null) return;
    let activo = true;
    setNotificaciones([]);

    const cargar = async () => {
      try {
        const data = await notificacionesApi.listar(usuarioId);
        if (activo) setNotificaciones(data);
      } catch {}
    };
    cargar();
    const timer = setInterval(cargar, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, [usuarioId]);

  const marcarLeida = useCallback(
    async (id: number) => {
      setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
      try {
        await notificacionesApi.marcarLeida(id);
      } catch {
        recargar();
      }
    },
    [recargar]
  );

  const marcarTodasLeidas = useCallback(async () => {
    if (usuarioId == null) return;
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    try {
      await notificacionesApi.marcarTodasLeidas(usuarioId);
    } catch {
      recargar();
    }
  }, [usuarioId, recargar]);

  const noLeidas = useMemo(() => notificaciones.filter((n) => !n.leida).length, [notificaciones]);

  return (
    <Ctx.Provider
      value={{ usuarios, usuarioId, setUsuarioId, notificaciones, noLeidas, recargar, marcarLeida, marcarTodasLeidas }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotificaciones() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotificaciones debe usarse dentro de <NotificacionesProvider>");
  return ctx;
}