import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useNotificaciones } from "../context/NotificacionesContext";

export default function CampanaNotificaciones() {
  const navigation = useNavigation<any>();
  const { noLeidas } = useNotificaciones();

  return (
    <TouchableOpacity
      style={styles.contenedor}
      onPress={() => navigation.navigate("Por completar", { screen: "Notificaciones" })}
    >
      <Text style={styles.icono}>🔔</Text>
      {noLeidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>{noLeidas > 99 ? "99+" : noLeidas}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 6 },
  icono: { fontSize: 22 },
  badge: {
    position: "absolute", top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#E53935", alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeTexto: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
});