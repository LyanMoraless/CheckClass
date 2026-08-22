// sessionStorage, not localStorage (approved stack): the token disappears
// when the tab closes, which is the right default for an internal admin
// tool with no "remember me" requirement.
const TOKEN_KEY = 'checkclass_access_token';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
