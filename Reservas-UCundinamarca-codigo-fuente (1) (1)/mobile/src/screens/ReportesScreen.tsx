import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import EncabezadoInstitucional from "../components/EncabezadoInstitucional";
import { COLORS } from "../theme/colors";
import { reportesApi, ReporteResumen, TipoEspacio } from "../services/api";

// ---------- utilidades ----------
const fmtFecha = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtMoneda = (n: number) =>
  "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const NOMBRE_TIPO: Record<TipoEspacio, string> = {
  cancha_futbol: "Fútbol",
  cancha_baloncesto: "Baloncesto",
  cancha_tenis: "Tenis",
  piscina: "Piscina",
  gimnasio: "Gimnasio",
};

const RANGOS: { key: string; label: string; calc: () => [Date, Date] }[] = [
  {
    key: "mes", label: "Este mes",
    calc: () => {
      const h = new Date();
      return [new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 1, 0)];
    },
  },
  {
    key: "atras30", label: "Últimos 30 días",
    calc: () => {
      const h = new Date();
      const d = new Date();
      d.setDate(h.getDate() - 30);
      return [d, h];
    },
  },
  {
    key: "adelante30", label: "Próximos 30 días",
    calc: () => {
      const h = new Date();
      const d = new Date();
      d.setDate(h.getDate() + 30);
      return [h, d];
    },
  },
  {
    key: "anio", label: "Este año",
    calc: () => {
      const y = new Date().getFullYear();
      return [new Date(y, 0, 1), new Date(y, 11, 31)];
    },
  },
];

// ---------- pantalla ----------
export default function ReportesScreen() {
  const [reporte, setReporte] = useState<ReporteResumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [rango, setRango] = useState("mes");
  const [tipo, setTipo] = useState<TipoEspacio | "todos">("todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [desde, hasta] = RANGOS.find((r) => r.key === rango)!.calc();
      const data = await reportesApi.resumen({
        desde: fmtFecha(desde),
        hasta: fmtFecha(hasta),
        tipo: tipo === "todos" ? undefined : tipo,
      });
      setReporte(data);
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar el reporte.");
    } finally {
      setCargando(false);
    }
  }, [rango, tipo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <EncabezadoInstitucional titulo="Reportes y Estadísticas" subtitulo="Requerimiento 5 de 8" />

      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}
      >
        {/* Filtro de período */}
        <Text style={styles.etiqueta}>Período</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {RANGOS.map((r) => (
            <Chip key={r.key} texto={r.label} activo={rango === r.key} onPress={() => setRango(r.key)} />
          ))}
        </ScrollView>

        {/* Filtro de tipo de espacio */}
        <Text style={styles.etiqueta}>Tipo de espacio</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip texto="Todos" activo={tipo === "todos"} onPress={() => setTipo("todos")} />
          {(Object.keys(NOMBRE_TIPO) as TipoEspacio[]).map((t) => (
            <Chip key={t} texto={NOMBRE_TIPO[t]} activo={tipo === t} onPress={() => setTipo(t)} />
          ))}
        </ScrollView>

        {cargando && !reporte && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />}

        {reporte && (
          <>
            {/* Tarjetas resumen */}
            <View style={styles.fila}>
              <Tarjeta titulo="Reservas" valor={String(reporte.total_reservas)} />
              <Tarjeta titulo="Ingresos" valor={fmtMoneda(reporte.ingresos_totales)} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitulo}>Espacio con más reservas</Text>
              {reporte.espacio_mas_reservado ? (
                <>
                  <Text style={styles.destacado}>{reporte.espacio_mas_reservado.nombre}</Text>
                  <Text style={styles.sub}>
                    {reporte.espacio_mas_reservado.total_reservas} reservas en el período
                  </Text>
                </>
              ) : (
                <Text style={styles.sub}>Sin reservas en este período.</Text>
              )}
            </View>

            {/* Ranking */}
            {reporte.ranking_espacios.length > 1 && (
              <View style={styles.card}>
                <Text style={styles.cardTitulo}>Ranking de espacios</Text>
                {reporte.ranking_espacios.map((e, i) => (
                  <View key={e.espacio_id} style={styles.filaLista}>
                    <Text style={styles.textoLista}>{i + 1}. {e.nombre}</Text>
                    <Text style={styles.valorLista}>{e.total_reservas}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Ingresos por mes */}
            <View style={styles.card}>
              <Text style={styles.cardTitulo}>Ingresos por mes</Text>
              {reporte.ingresos_por_mes.length === 0 ? (
                <Text style={styles.sub}>Sin pagos aprobados en este período.</Text>
              ) : (
                reporte.ingresos_por_mes.map((i) => (
                  <View key={i.mes} style={styles.filaLista}>
                    <Text style={styles.textoLista}>{i.mes}</Text>
                    <Text style={styles.valorLista}>{fmtMoneda(i.total)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Ocupación por tipo */}
            <View style={styles.card}>
              <Text style={styles.cardTitulo}>Ocupación por tipo de espacio</Text>
              {reporte.ocupacion_por_tipo.map((o) => (
                <View key={o.tipo} style={{ marginBottom: 12 }}>
                  <View style={styles.filaLista}>
                    <Text style={styles.textoLista}>{NOMBRE_TIPO[o.tipo]}</Text>
                    <Text style={styles.valorLista}>{o.porcentaje}%</Text>
                  </View>
                  <View style={styles.barraFondo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${Math.min(o.porcentaje, 100)}%`, minWidth: o.porcentaje > 0 ? 3 : 0 },
                      ]}
                    />
                  </View>
                  <Text style={styles.sub}>
                    {o.horas_reservadas} h reservadas de {o.horas_disponibles} h disponibles
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---------- componentes pequeños ----------
function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{texto}</Text>
    </TouchableOpacity>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Text style={styles.sub}>{titulo}</Text>
      <Text style={styles.valorGrande}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, gap: 12, paddingBottom: 32 },
  etiqueta: { color: COLORS.textGray, fontSize: 12, fontWeight: "700" },
  chips: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { color: COLORS.textDark, fontSize: 13, fontWeight: "600" },
  chipTextoActivo: { color: "#fff" },
  fila: { flexDirection: "row", gap: 12 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, gap: 4,
  },
  cardTitulo: { color: COLORS.primary, fontWeight: "700", fontSize: 14.5, marginBottom: 6 },
  destacado: { color: COLORS.textDark, fontSize: 18, fontWeight: "800" },
  valorGrande: { color: COLORS.primary, fontSize: 22, fontWeight: "800" },
  sub: { color: COLORS.textGray, fontSize: 12 },
  filaLista: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  textoLista: { color: COLORS.textDark, fontSize: 14 },
  valorLista: { color: COLORS.textDark, fontSize: 14, fontWeight: "700" },
  barraFondo: { height: 10, borderRadius: 5, backgroundColor: COLORS.border, overflow: "hidden", marginVertical: 4 },
  barra: { height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
});