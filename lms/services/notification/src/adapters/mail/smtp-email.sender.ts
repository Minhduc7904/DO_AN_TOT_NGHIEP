import { observeDependency } from '@aiops-lms/common/telemetry';
import nodemailer, { type Transporter } from 'nodemailer';

import type { Email, EmailSender } from '../../application/ports/email-sender.js';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  password?: string | undefined;
  from: string;
  timeoutMs: number;
}

const DEPENDENCY = 'notification-smtp';

/** Cạnh `notification-worker → notification-smtp` (Mailpit ở dev/CI; đổi biến môi trường cho SMTP thật). */
export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      connectionTimeout: settings.timeoutMs,
      greetingTimeout: settings.timeoutMs,
      socketTimeout: settings.timeoutMs,
      ...(settings.user ? { auth: { user: settings.user, pass: settings.password ?? '' } } : {}),
    });
  }

  send(email: Email): Promise<void> {
    return observeDependency(
      DEPENDENCY,
      'smtp.send',
      async () => {
        await this.transport.sendMail({
          from: this.settings.from,
          to: email.to,
          subject: email.subject,
          text: email.text,
        });
      },
      { attributes: { 'network.protocol.name': 'smtp' } },
    );
  }

  close(): void {
    this.transport.close();
  }
}
