function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

export function passwordResetEmail(input: {
  appName: string;
  resetUrl: string;
  expirationMinutes: number;
}): { subject: string; html: string; text: string } {
  const appName = escapeHtml(input.appName);
  const resetUrl = escapeHtml(input.resetUrl);
  const minutes = input.expirationMinutes;

  return {
    subject: `Restablece tu contraseña de ${input.appName}`,
    text: `Restablece tu contraseña\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta en ${input.appName}.\n\nRestablece tu contraseña: ${input.resetUrl}\n\nEste enlace expirará en ${minutes} minutos. Si tú no solicitaste este cambio, puedes ignorar este correo.\n\n${input.appName}`,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Restablece tu contraseña</title></head><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#18202a"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8ebef;border-radius:12px"><tr><td style="padding:34px 32px 12px;text-align:center"><div style="font-size:18px;font-weight:700;letter-spacing:.2px;color:#18202a">${appName}</div></td></tr><tr><td style="padding:12px 32px 34px"><h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;text-align:center;color:#18202a">Restablece tu contraseña</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#536170">Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center"><a href="${resetUrl}" style="display:inline-block;background:#18202a;color:#ffffff;text-decoration:none;border-radius:8px;padding:14px 22px;font-size:16px;font-weight:700">Restablecer contraseña</a></td></tr></table><p style="margin:24px 0 8px;font-size:14px;line-height:1.5;color:#536170">Este enlace expirará en ${minutes} minutos.</p><p style="margin:0;font-size:13px;line-height:1.5;color:#7a8794">Si el botón no funciona, copia y pega este enlace en tu navegador:</p><p style="margin:8px 0 0;word-break:break-all;font-size:13px;line-height:1.5"><a href="${resetUrl}" style="color:#315f9b">${resetUrl}</a></p></td></tr><tr><td style="padding:20px 32px 28px;border-top:1px solid #eef0f3;text-align:center;font-size:13px;line-height:1.5;color:#7a8794">Si tú no solicitaste este cambio, puedes ignorar este correo.<br>${appName}</td></tr></table></td></tr></table></body></html>`,
  };
}
