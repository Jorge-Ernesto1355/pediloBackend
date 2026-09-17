import { auth } from '@/libs/auth.js';
import { BetterAuthProvider } from '../../infrastructure/persistence/security/BetterAuthProvider.js';

export const authProvider = new BetterAuthProvider(auth);
