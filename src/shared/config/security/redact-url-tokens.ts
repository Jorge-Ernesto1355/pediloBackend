/**
 * Quita de una URL los segmentos que son llaves secretas (links privados de tarjetas de
 * lealtad y de entregas: 32+ caracteres base64url), para que nunca queden en logs ni en
 * reportes de errores. Los ids normales (cuid, 25 caracteres) no se tocan.
 */
const SECRET_SEGMENT = /^[A-Za-z0-9_-]{32,}$/;

export function redactUrlTokens(url: string): string {
  const queryStart = url.search(/[?#]/);
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  const rest = queryStart === -1 ? '' : url.slice(queryStart);
  const redactedPath = path
    .split('/')
    .map((segment) => (SECRET_SEGMENT.test(segment) ? ':token' : segment))
    .join('/');
  const redactedRest = rest.replace(/([?&#][^=&#]*=)([A-Za-z0-9_-]{32,})/g, '$1:token');
  return redactedPath + redactedRest;
}
