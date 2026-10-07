import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { prisma } from '@/libs/prisma.js';

function isDedicatedTestDatabase(): boolean {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;

  try {
    const databaseUrl = new URL(connectionString);
    const databaseName = databaseUrl.pathname.replace(/^\//, '');
    return (
      databaseUrl.hostname === 'localhost' ||
      databaseUrl.hostname === '127.0.0.1' ||
      /(^|[-_])(test|testing|e2e)([-_]|$)/i.test(databaseName)
    );
  } catch {
    return false;
  }
}

const integrationEnabled = process.env.RUN_AUTH_DATABASE_INTEGRATION === 'true';
const safeDatabase = isDedicatedTestDatabase();
const runDatabaseIntegration = integrationEnabled && safeDatabase;
const describeDatabaseIntegration = runDatabaseIntegration ? describe : describe.skip;

describeDatabaseIntegration('Auth signup session isolation (PostgreSQL integration)', () => {
  let server: Server;
  let apiBaseUrl = '';
  let emailA = '';
  let emailBWithoutPriorSession = '';
  let emailB = '';
  const passwordA = 'Strong-pass-A-123';
  const passwordB = 'Strong-pass-B-123';
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  beforeAll(async () => {
    if (integrationEnabled && !safeDatabase) {
      throw new Error(
        'Auth DB integration requires DATABASE_URL to target localhost or a database named test/testing/e2e.',
      );
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    emailA = `auth-session-a-${suffix}@example.test`;
    emailBWithoutPriorSession = `auth-session-b-empty-${suffix}@example.test`;
    emailB = `auth-session-b-replace-${suffix}@example.test`;
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Could not start test HTTP server');
    apiBaseUrl = `http://127.0.0.1:${address.port}/api/v1/auth`;
  });

  afterAll(async () => {
    if (emailA || emailB || emailBWithoutPriorSession) {
      await prisma.user.deleteMany({
        where: { email: { in: [emailA, emailB, emailBWithoutPriorSession].filter(Boolean) } },
      });
    }
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await prisma.$disconnect();
  });

  it('creates B as the active session after A, preserves both DB users and sessions, rejects duplicate signup, and allows login as A', async () => {
    const request = (path: string, body?: unknown, cookie?: string) =>
      fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin,
          ...(cookie ? { cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const signup = (email: string, password: string, name: string, cookie?: string) =>
      request('/register', { email, password, name }, cookie);
    const cookieFrom = (response: Response) => {
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie, 'signup/login must set a session cookie').to.be.a('string');
      return setCookie!.split(';', 1)[0]!;
    };
    const currentUser = async (cookie: string) => {
      const response = await request('/me', undefined, cookie);
      const body = (await response.json()) as { user?: { id?: string; email?: string } };
      expect(response.status).toBe(200);
      return body.user;
    };

    // A: signup without a prior cookie creates B and a persisted B session.
    const signupB = await signup(emailBWithoutPriorSession, passwordB, 'User B');
    expect(signupB.status).toBe(201);
    const signupBBody = (await signupB.json()) as { user: { id: string; email: string } };
    expect(signupBBody.user.email).toBe(emailBWithoutPriorSession);
    const cookieB = cookieFrom(signupB);
    expect(await currentUser(cookieB)).toMatchObject({
      id: signupBBody.user.id,
      email: emailBWithoutPriorSession,
    });

    const userBWithoutPriorSession = await prisma.user.findUnique({
      where: { email: emailBWithoutPriorSession },
    });
    expect(userBWithoutPriorSession?.id).toBe(signupBBody.user.id);
    const sessionsBWithoutPriorSession = await prisma.session.findMany({
      where: { userId: userBWithoutPriorSession!.id },
    });
    expect(sessionsBWithoutPriorSession).toHaveLength(1);

    // B: create A, then signup B while explicitly sending A's still-valid cookie.
    const signupA = await signup(emailA, passwordA, 'User A');
    expect(signupA.status).toBe(201);
    const signupABody = (await signupA.json()) as { user: { id: string; email: string } };
    const cookieA = cookieFrom(signupA);
    const userA = await prisma.user.findUnique({ where: { email: emailA } });
    expect(userA?.id).toBe(signupABody.user.id);
    const [sessionAOriginal] = await prisma.session.findMany({ where: { userId: userA!.id } });
    expect(sessionAOriginal).toBeDefined();
    expect(await currentUser(cookieA)).toMatchObject({ id: userA!.id, email: emailA });

    const signupBWithSessionA = await signup(emailB, passwordB, 'User B', cookieA);
    expect(signupBWithSessionA.status).toBe(201);
    const signupBWithSessionABody = (await signupBWithSessionA.json()) as {
      user: { id: string; email: string };
    };
    expect(signupBWithSessionABody.user.email).toBe(emailB);
    const userB = await prisma.user.findUnique({ where: { email: emailB } });
    expect(userB?.id).toBe(signupBWithSessionABody.user.id);
    const cookieBFromA = cookieFrom(signupBWithSessionA);
    expect(cookieBFromA).not.toBe(cookieA);
    expect(await currentUser(cookieBFromA)).toMatchObject({ id: userB!.id, email: emailB });

    // C: both users remain; B's active cookie did not update, replace, or revoke A's session.
    expect(await prisma.user.findUnique({ where: { id: userA!.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: userB!.id } })).not.toBeNull();
    expect(await currentUser(cookieA)).toMatchObject({ id: userA!.id, email: emailA });
    const [sessionAAfterSignupB] = await prisma.session.findMany({ where: { userId: userA!.id } });
    expect(sessionAAfterSignupB).toMatchObject({
      id: sessionAOriginal!.id,
      token: sessionAOriginal!.token,
      userId: userA!.id,
      updatedAt: sessionAOriginal!.updatedAt,
    });
    const sessionBFromSignup = await prisma.session.findFirst({ where: { userId: userB!.id } });
    expect(sessionBFromSignup?.userId).toBe(userB!.id);

    // F: the cookie scope must match so the browser replaces the prior value.
    const cookieAResponse = signupA.headers.get('set-cookie')!;
    const cookieBResponse = signupBWithSessionA.headers.get('set-cookie')!;
    for (const attribute of ['Path=/', 'HttpOnly', 'SameSite=Lax']) {
      expect(cookieAResponse).toContain(attribute);
      expect(cookieBResponse).toContain(attribute);
    }
    expect(cookieAResponse).toMatch(/Max-Age=604800/i);
    expect(cookieBResponse).toMatch(/Max-Age=604800/i);
    expect(cookieBFromA.split('=', 1)[0]).toBe(cookieA.split('=', 1)[0]);
    const cookieScope = (value: string) =>
      value
        .split(';')
        .slice(1)
        .map((attribute) => attribute.trim())
        .filter((attribute) => /^(domain|path)=/i.test(attribute))
        .map((attribute) => attribute.toLowerCase())
        .sort();
    expect(cookieScope(cookieBResponse)).toEqual(cookieScope(cookieAResponse));

    // E: duplicate signup does not set a new cookie or change the current account A.
    const duplicateSignup = await signup(emailA, 'Another-Strong-123', 'Duplicate A', cookieA);
    expect(duplicateSignup.status).toBe(409);
    expect(duplicateSignup.headers.get('set-cookie')).toBeNull();
    expect(await currentUser(cookieA)).toMatchObject({ id: userA!.id, email: emailA });

    // D: logout B revokes B's DB session; logging in as A returns an A-owned session.
    const logoutB = await request('/logout', undefined, cookieBFromA);
    expect(logoutB.status).toBe(204);
    expect(await prisma.session.findMany({ where: { userId: userB!.id } })).toHaveLength(0);

    const loginA = await request('/login', { email: emailA, password: passwordA });
    expect(loginA.status).toBe(200);
    const loginABody = (await loginA.json()) as { user: { id: string; email: string } };
    expect(loginABody.user).toMatchObject({ id: userA!.id, email: emailA });
    expect(await currentUser(cookieFrom(loginA))).toMatchObject({ id: userA!.id, email: emailA });
  });
});

it.skipIf(!integrationEnabled || safeDatabase)(
  'requires a dedicated localhost/test database before enabling signup integration checks',
  () => {
    throw new Error(
      'Set RUN_AUTH_DATABASE_INTEGRATION=true only with DATABASE_URL pointing to localhost or a database named test/testing/e2e.',
    );
  },
);
