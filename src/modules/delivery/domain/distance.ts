export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Factor para aproximar la distancia real por calles a partir de la distancia en línea recta.
 * Se aplica siempre en el backend; el cliente nunca envía distancias.
 */
export const ROUTE_FACTOR = 1.3;

const EARTH_RADIUS_KM = 6371.0088;

/** Distancia en línea recta (gran círculo) entre dos puntos, en km, sin redondear. */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Redondea a 1 decimal (mitad hacia arriba). Todas las comparaciones de tramos usan este valor. */
export function roundDistanceKm(km: number): number {
  // Primero se normaliza a 6 decimales para que valores como 2.05 (guardado como
  // 2.04999…) no se redondeen hacia abajo por error de punto flotante.
  return Math.round(Math.round(km * 1e6) / 1e5) / 10;
}

/** Distancia de envío: línea recta × ROUTE_FACTOR, redondeada a 1 decimal. */
export function deliveryDistanceKm(from: Coordinates, to: Coordinates): number {
  return roundDistanceKm(haversineKm(from, to) * ROUTE_FACTOR);
}

export function isValidCoordinates(value: Coordinates): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}
