import { User } from '../entities/User';

export interface AuthSessionReader {
  getSession(headers: Headers): Promise<User | null>;
}

export interface AuthSessionResult {
  user: User;
  setCookie: string[];
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export interface SignInInput {
  email: string;
  password: string;
}
export interface AuthProvider extends AuthSessionReader {
  signUp(input: SignUpInput): Promise<AuthSessionResult>;
  signIn(input: SignInInput): Promise<AuthSessionResult>;
  getSession(headers: Headers): Promise<User | null>;
  signOut(headers: Headers): Promise<void>;
}
