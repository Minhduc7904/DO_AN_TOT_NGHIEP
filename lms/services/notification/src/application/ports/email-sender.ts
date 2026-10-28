export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Cạnh `notification-worker → notification-smtp`; ném lỗi khi không gửi được. */
export interface EmailSender {
  send(email: Email): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
