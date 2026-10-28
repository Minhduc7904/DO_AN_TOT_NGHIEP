import type { Account } from '../../../domain/account.js';
import type { TokenPair } from '../../token-issuer.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult extends TokenPair {
  principal: { id: string; role: Account['role'] };
}
