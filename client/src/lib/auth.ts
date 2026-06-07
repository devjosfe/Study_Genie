// Auth is now handled by Better Auth (cookie-based sessions).
// This file is kept for backwards compatibility but all token logic is removed.
// Use authClient from ./auth-client.ts instead.

export { authClient } from "./auth-client.js";
