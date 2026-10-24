import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
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
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const [, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh(n => n + 1);
    document.addEventListener("clarity:route", listener);
    return () => document.removeEventListener("clarity:route", listener);
  }, []);
  useEffect(() => {
    if (!isLoaded) return;
    document.body.classList.toggle("signed-in", !!user);
    document.dispatchEvent(new CustomEvent("clarity:auth", { detail: { signedIn: !!user } }));
    if (user && window.location.pathname === "/" && !window.location.hash.replace(/^#\/?/, "")) {
      window.location.replace("/user-portal");
    }
  }, [isLoaded, user?.id]);
  const controls = <div className="account-controls">
    <Show when="signed-out"><a className="btn sm" href="/sign-in">Sign in with Google</a></Show>
    <Show when="signed-in">
      <span className="small">Hi, {user?.firstName || "there"}</span>
      <button type="button" className="btn sm" onClick={() => {
        document.dispatchEvent(new Event("clarity:signout"));
        signOut({ redirectUrl: "/" });
      }}>Sign out</button>
    </Show>
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
