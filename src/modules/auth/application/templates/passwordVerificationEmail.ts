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

export function passwordVerificationEmail(input: {
  appName: string;
  verificationUrl: string;
  expirationMinutes: number;
}) {
  const appName = escapeHtml(input.appName);
  const url = escapeHtml(input.verificationUrl);
  return {
    subject: `Verifica tu correo de ${input.appName}`,
    text: `Verifica tu correo\n\nConfirma tu dirección de correo para activar tu cuenta en ${input.appName}: ${input.verificationUrl}\n\nEste enlace expirará en ${input.expirationMinutes} minutos.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#18202a"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;background:#f6f7f9"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e8ebef;border-radius:12px"><tr><td style="padding:34px 32px 12px;text-align:center;font-size:18px;font-weight:700">${appName}</td></tr><tr><td style="padding:12px 32px 34px"><h1 style="margin:0 0 16px;text-align:center;font-size:26px">Verifica tu correo</h1><p style="font-size:16px;line-height:1.6;color:#536170">Confirma tu dirección de correo para activar tu cuenta.</p><table role="presentation" width="100%"><tr><td align="center"><a href="${url}" style="display:inline-block;background:#18202a;color:#fff;text-decoration:none;border-radius:8px;padding:14px 22px;font-size:16px;font-weight:700">Verificar correo</a></td></tr></table><p style="font-size:13px;line-height:1.5;color:#7a8794;word-break:break-all">Si el botón no funciona, copia este enlace:<br><a href="${url}" style="color:#315f9b">${url}</a></p></td></tr><tr><td style="padding:20px 32px 28px;border-top:1px solid #eef0f3;text-align:center;font-size:13px;color:#7a8794">Este enlace expirará en ${input.expirationMinutes} minutos.<br>${appName}</td></tr></table></td></tr></table></body></html>`,
  };
}
