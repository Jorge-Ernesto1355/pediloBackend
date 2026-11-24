import type { Coordinates } from './distance.js';

/**
 * Zona aproximada para la oferta pública, SIN revelar calle, número ni coordenadas:
 * la colonia (si existe), la distancia (ya redondeada) y la dirección cardinal desde el
 * restaurante. Ej. "Col. Centro · 3.4 km al noreste del restaurante".
 */
export function approximateZone(
  origin: Coordinates | null,
  destination: Coordinates | null,
  distanceKm: number,
  neighborhood: string | null = null,
): string {
  const distance = `${distanceKm.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
  const fromRestaurant =
    !origin || !destination || distanceKm < 0.3
      ? `${distance} del restaurante`
      : `${distance} al ${cardinalDirection(origin, destination)} del restaurante`;
  const colonia = neighborhoodLabel(neighborhood);
  return colonia ? `${colonia} · ${fromRestaurant}` : fromRestaurant;
}

/**
 * "Centro", "col. centro" o "Colonia Centro" -> "Col. Centro". Vacío -> null.
 * El prefijo exige separador para no recortar colonias como "Colosio".
 */
export function neighborhoodLabel(neighborhood: string | null): string | null {
  const name = neighborhood
    ?.trim()
    .replace(/^(colonia(\s+|$)|col\.\s*|col(\s+|$))/i, '')
    .trim();
  if (!name) return null;
  return `Col. ${name.charAt(0).toLocaleUpperCase('es-MX')}${name.slice(1)}`;
}

const directions = [
  'norte',
  'noreste',
  'este',
  'sureste',
  'sur',
  'suroeste',
  'oeste',
  'noroeste',
] as const;

export function cardinalDirection(from: Coordinates, to: Coordinates): (typeof directions)[number] {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLongitude) * Math.cos(toRadians(to.latitude));
  const x =
    Math.cos(toRadians(from.latitude)) * Math.sin(toRadians(to.latitude)) -
    Math.sin(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.cos(deltaLongitude);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return directions[Math.round(bearing / 45) % 8]!;
}
