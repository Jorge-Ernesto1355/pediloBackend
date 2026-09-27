import { env } from '@/shared/config/env.js';
import { EmailMessage, EmailService } from '../../application/ports/EmailService.js';
import { Resend } from 'resend';

export class ResendEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error('Email delivery is not configured: RESEND_API_KEY and EMAIL_FROM are required');
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      throw new Error(`Resend rejected the email: ${error.message}`);
    }
  }
}
