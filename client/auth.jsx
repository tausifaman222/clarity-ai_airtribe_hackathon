import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const appearance = {
  theme: shadcn,
  options: { logoPlacement: "inside", logoLinkUrl: "/", logoImageUrl: `${window.location.origin}/logo.svg`, socialButtonsPlacement: "top" },
  variables: {
    colorPrimary: "#17645a", colorForeground: "#173e3b", colorMutedForeground: "#476562",
    colorBackground: "#fffdf7", colorInput: "#fffdf7", colorInputForeground: "#173e3b",
    colorDanger: "#b63838", colorNeutral: "#476562", fontFamily: '"DM Sans", sans-serif', borderRadius: "14px",
  },
  elements: {
    rootBox: { display: "flex", justifyContent: "center", width: "100%" },
    cardBox: { background: "#fffdf7", width: "440px", maxWidth: "100%", borderRadius: "20px", overflow: "hidden" },
    card: { background: "transparent", boxShadow: "none" }, footer: { background: "transparent" },
    headerTitle: { color: "#173e3b" }, headerSubtitle: { color: "#476562" },
    socialButtonsBlockButtonText: { color: "#173e3b" }, formFieldLabel: { color: "#173e3b" },
    footerActionLink: { color: "#17645a" }, footerActionText: { color: "#476562" },
    dividerText: { color: "#476562" }, identityPreviewEditButton: { color: "#17645a" },
    formFieldSuccessText: { color: "#166349" }, alertText: { color: "#b63838" },
  },
};

function Header() {
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const result = response.ok ? await response.json() : null;
        if (!active) return;
        setAccount(result?.user || null);
        document.body.classList.toggle("signed-in", !!result?.user);
        document.dispatchEvent(new CustomEvent("clarity:auth", { detail: { signedIn: !!result?.user } }));
      } catch { if (active) setAccount(null); }
    };
    const listener = () => refresh();
    document.addEventListener("clarity:route", listener);
    refresh();
    return () => {
      active = false;
      document.removeEventListener("clarity:route", listener);
    };
  }, []);
  const controls = <div className="account-controls">
    {account ? <>
      <span className="small">Hi, {account.username}</span>
      <button type="button" className="btn sm" disabled={busy} onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
        if (response?.ok) {
          document.dispatchEvent(new Event("clarity:signout"));
          setAccount(null);
          document.body.classList.remove("signed-in");
        } else setBusy(false);
      }}>{busy ? "Signing out…" : "Sign out"}</button>
    </> : <>
      <a className="btn sm" href="/sign-in">Sign in</a>
      <a className="btn sm primary" href="/sign-up">Create account</a>
    </>}
    <span className="google-coming-soon">Google · Coming soon</span>
  </div>;
  return [...document.querySelectorAll("[data-auth-controls]")].map((target, i) => createPortal(controls, target, String(i)));
}

function Provider() {
  const [, setLocation] = useLocation();
  const stripBase = path => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
  const signingIn = /^\/sign-(in|up)(\/|$)/.test(window.location.pathname);
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={appearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl="/user-portal"
    signUpFallbackRedirectUrl="/user-portal"
    localization={{
      signIn: { start: { title: "Welcome to Clarity AI", subtitle: "Sign in to save your verified practice scores." } },
      signUp: { start: { title: "Find your voice", subtitle: "Join Clarity AI and track your progress." } },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    {signingIn ? <div className="auth-page"><a href="/" className="auth-back">← Back to Clarity AI</a><Switch>
      <Route path="/sign-in/*?"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></Route>
      <Route path="/sign-up/*?"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></Route>
    </Switch><p className="small muted">Your scores stay private unless you choose to publish them.</p></div> : <Header />}
  </ClerkProvider>;
}
createRoot(document.getElementById("auth-root")).render(<WouterRouter base={basePath}><Provider /></WouterRouter>);
