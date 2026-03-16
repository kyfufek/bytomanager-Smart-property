export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type StoredUser = AuthUser & {
  password: string;
};

const USERS_KEY = "bytomanager_auth_users";
const SESSION_KEY = "bytomanager_auth_session";

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function writeSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): AuthUser | null {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const user = users.find(
    (item) =>
      normalizeEmail(item.email) === normalizedEmail && item.password === password
  );

  if (!user) return null;

  const sessionUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
  };
  writeSession(sessionUser);
  return sessionUser;
}

export function register(name: string, email: string, password: string): AuthUser | null {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const exists = users.some((item) => normalizeEmail(item.email) === normalizedEmail);
  if (exists) return null;

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password,
  };

  users.push(newUser);
  writeUsers(users);

  const sessionUser: AuthUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
  };
  writeSession(sessionUser);
  return sessionUser;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
