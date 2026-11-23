import { z } from 'zod';

/**
 * Diseño de la tarjeta de lealtad (versión 1).
 * Es una LISTA CERRADA de valores: nunca se guarda CSS libre. El frontend convierte cada
 * valor en variables CSS y clases; los textos se muestran siempre escapados.
 *
 * Las plantillas completas viven en el frontend (son datos, no componentes). La plantilla
 * por defecto de aquí debe coincidir con `clasica` del frontend
 * (app/(protected)/create-menu/features/loyalty/loyaltyTemplates.ts).
 */
export const LOYALTY_DESIGN_VERSION = 1;

export const DESIGN_TEMPLATES = [
  'clasica',
  'moderna',
  'oscura',
  'calida',
  'minimal',
  'festiva',
] as const;
export const BACKGROUND_TYPES = ['solid', 'gradient', 'pattern'] as const;
export const BACKGROUND_PATTERNS = [
  'none',
  'dots',
  'grid',
  'waves',
  'diagonal',
  'confetti',
] as const;
export const TEXT_FONTS = ['sans', 'serif', 'rounded', 'mono', 'display'] as const;
export const STAMP_SHAPES = [
  'circle',
  'rounded-square',
  'star',
  'heart',
  'hexagon',
  'shield',
] as const;
export const STAMP_ICONS = [
  'check',
  'flame',
  'coffee',
  'pizza',
  'burger',
  'taco',
  'star',
  'heart',
  'crown',
  'leaf',
] as const;
export const STAMP_SIZES = ['sm', 'md', 'lg'] as const;
export const EMPTY_STYLES = ['outline', 'dashed', 'dimmed', 'number'] as const;
export const LAYOUT_COLUMNS = ['auto', 2, 3, 4, 5, 6] as const;
export const REWARD_SLOTS = ['icon', 'none'] as const;
export const CARD_RADII = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export const CARD_SHADOWS = ['none', 'soft'] as const;
export const STAMP_EFFECTS = ['press', 'pop', 'ink', 'spin', 'bounce'] as const;
export const COMPLETION_EFFECTS = ['confetti', 'sparkles', 'glow', 'none'] as const;
export const ANIMATION_SPEEDS = ['slow', 'normal', 'fast'] as const;

export const DESIGN_TITLE_MAX_LENGTH = 30;
export const DESIGN_SUBTITLE_MAX_LENGTH = 40;

/** Solo #RRGGBB (6 dígitos hex). Se normaliza a mayúsculas. */
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const hexColor = z
  .string()
  .regex(HEX_COLOR, 'Usa un color hex con la forma #RRGGBB.')
  .transform((value) => value.toUpperCase());

/** Quita caracteres de control y espacios repetidos; el resto se muestra escapado. */
export function cleanDesignText(value: string): string {
  return value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const designText = (max: number) =>
  z
    .string()
    .transform(cleanDesignText)
    .refine((value) => value.length <= max, `Máximo ${max} caracteres.`);

export const loyaltyDesignSchema = z
  .object({
    template: z.enum(DESIGN_TEMPLATES),
    background: z
      .object({
        type: z.enum(BACKGROUND_TYPES),
        color1: hexColor,
        color2: hexColor,
        angle: z.number().int().min(0).max(360),
        pattern: z.enum(BACKGROUND_PATTERNS),
        patternOpacity: z.number().min(0).max(1),
      })
      .strict(),
    text: z
      .object({
        primaryColor: hexColor,
        secondaryColor: hexColor,
        font: z.enum(TEXT_FONTS),
        title: designText(DESIGN_TITLE_MAX_LENGTH),
        subtitle: designText(DESIGN_SUBTITLE_MAX_LENGTH),
        showLogo: z.boolean(),
      })
      .strict(),
    stamp: z
      .object({
        shape: z.enum(STAMP_SHAPES),
        icon: z.enum(STAMP_ICONS),
        size: z.enum(STAMP_SIZES),
        filledColor: hexColor,
        iconColor: hexColor,
        emptyColor: hexColor,
        emptyStyle: z.enum(EMPTY_STYLES),
      })
      .strict(),
    layout: z
      .object({
        columns: z.union([z.literal('auto'), z.number().int().min(2).max(6)]),
        rewardSlot: z.enum(REWARD_SLOTS),
      })
      .strict(),
    card: z
      .object({
        radius: z.enum(CARD_RADII),
        border: z.boolean(),
        borderColor: hexColor,
        shadow: z.enum(CARD_SHADOWS),
      })
      .strict(),
    animation: z
      .object({
        stampEffect: z.enum(STAMP_EFFECTS),
        completionEffect: z.enum(COMPLETION_EFFECTS),
        speed: z.enum(ANIMATION_SPEEDS),
      })
      .strict(),
  })
  .strict();

export type LoyaltyDesign = z.infer<typeof loyaltyDesignSchema>;

/** Título por defecto: el nombre del restaurante (recortado al máximo permitido). */
export function defaultDesignTitle(restaurantName: string): string {
  return cleanDesignText(restaurantName).slice(0, DESIGN_TITLE_MAX_LENGTH).trim();
}

/** Plantilla `clasica` (la misma del frontend) con el nombre del restaurante como título. */
export function defaultLoyaltyDesign(restaurantName: string): LoyaltyDesign {
  return {
    template: 'clasica',
    background: {
      type: 'solid',
      color1: '#F8F4EC',
      color2: '#EFE6D4',
      angle: 135,
      pattern: 'none',
      patternOpacity: 0.12,
    },
    text: {
      primaryColor: '#10224A',
      secondaryColor: '#4A5878',
      font: 'serif',
      title: defaultDesignTitle(restaurantName),
      subtitle: 'Tarjeta de lealtad',
      showLogo: true,
    },
    stamp: {
      shape: 'circle',
      icon: 'check',
      size: 'md',
      filledColor: '#1E40AF',
      iconColor: '#FFFFFF',
      emptyColor: '#8A97B1',
      emptyStyle: 'dashed',
    },
    layout: { columns: 'auto', rewardSlot: 'icon' },
    card: { radius: 'lg', border: true, borderColor: '#E3DCCB', shadow: 'soft' },
    animation: { stampEffect: 'press', completionEffect: 'glow', speed: 'normal' },
  };
}

/**
 * Lee un diseño guardado. Si por cualquier motivo ya no es válido (por ejemplo, una
 * versión futura), se devuelve el diseño por defecto en vez de romper la tarjeta.
 */
export function readStoredDesign(value: unknown, restaurantName: string): LoyaltyDesign {
  const parsed = loyaltyDesignSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultLoyaltyDesign(restaurantName);
}
