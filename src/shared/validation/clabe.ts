export type ClabeTheme = { background: string; foreground: string };
export type ClabeBank = { code: string; name: string; theme: ClabeTheme };

const banks: Record<string, ClabeBank> = {
  '002': { code: '002', name: 'Banamex', theme: { background: '#0B3A82', foreground: '#FFFFFF' } },
  '012': { code: '012', name: 'BBVA', theme: { background: '#004481', foreground: '#FFFFFF' } },
  '014': { code: '014', name: 'Santander', theme: { background: '#D71920', foreground: '#FFFFFF' } },
  '021': { code: '021', name: 'HSBC', theme: { background: '#7A0019', foreground: '#FFFFFF' } },
  '030': { code: '030', name: 'BanBajío', theme: { background: '#B61F2A', foreground: '#FFFFFF' } },
  '036': { code: '036', name: 'Inbursa', theme: { background: '#0073A8', foreground: '#FFFFFF' } },
  '044': { code: '044', name: 'Scotiabank', theme: { background: '#C8102E', foreground: '#FFFFFF' } },
  '058': { code: '058', name: 'Banregio', theme: { background: '#0B6073', foreground: '#FFFFFF' } },
  '062': { code: '062', name: 'Afirme', theme: { background: '#1D3E72', foreground: '#FFFFFF' } },
  '072': { code: '072', name: 'Banorte', theme: { background: '#B32025', foreground: '#FFFFFF' } },
  '127': { code: '127', name: 'Banco Azteca', theme: { background: '#23894A', foreground: '#FFFFFF' } },
  '137': { code: '137', name: 'BanCoppel', theme: { background: '#006B55', foreground: '#FFFFFF' } },
  '646': { code: '646', name: 'STP', theme: { background: '#4B5563', foreground: '#FFFFFF' } },
  '722': { code: '722', name: 'Mercado Pago', theme: { background: '#00A8E8', foreground: '#063B5C' } },
};

export function normalizeClabe(value: string): string {
  return value.replace(/\D/g, '').slice(0, 18);
}

export function isValidClabe(value: string): boolean {
  const normalized = normalizeClabe(value);
  if (!/^\d{18}$/.test(normalized)) return false;
  const weights = [3, 7, 1];
  const sum = normalized.slice(0, 17).split('').reduce(
    (total, digit, index) => total + ((Number(digit) * (weights[index % 3] ?? 0)) % 10),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(normalized.charAt(17));
}

export function detectBank(clabe: string): ClabeBank {
  const code = normalizeClabe(clabe).slice(0, 3);
  return banks[code] ?? {
    code,
    name: 'Banco',
    theme: { background: '#5B6472', foreground: '#FFFFFF' },
  };
}

export const CLABE_BANKS = banks;
