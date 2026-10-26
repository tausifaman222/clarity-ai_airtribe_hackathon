// Kept for compatibility: Google sign-in now runs on the shared OAuth engine in oauth.js.
import { registerOAuth, providerConfigured, redirectUri as providerRedirect } from "./oauth.js";
export const googleConfigured = () => providerConfigured("google");
export const redirectUri = req => providerRedirect(req, "google");
export const registerGoogleAuth = (app, opts = {}) => registerOAuth(app, { ...opts, only: ["google"] });
