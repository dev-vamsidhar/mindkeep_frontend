"use client";
import { useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, displayName, useUser } from "@/lib/firebase";
import { signOut as storeSignOut } from "@/lib/store";
import Icon from "./Icon";

const messages: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/account-exists-with-different-credential": "This email already signs in another way. Use email and password.",
};
const quiet = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

// ponytail: plan/billing details below are still placeholders until there is a billing API.
export default function ProfileMenu() {
  const fbUser = useUser();
  const user = fbUser && { email: fbUser.email ?? "", name: displayName(fbUser) };
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setLogin(false));
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, []);

  const attempt = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      setLogin(false);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (!quiet.includes(code)) setError(messages[code] ?? "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const signIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [email, password] = [String(f.get("email")).trim(), String(f.get("password"))];
    attempt(() => (signup ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth(), email, password));
  };
  const google = () => attempt(() => signInWithPopup(auth(), new GoogleAuthProvider()));
  const openLogin = () => { setError(""); setSignup(false); setLogin(true); };
  const signOut = () => {
    setOpen(false);
    storeSignOut();
  };

  const item = "w-full flex items-center gap-space-sm px-space-md py-1.5 rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-left";

  return (
    <div ref={ref} className="relative mt-auto">
      {!user ? (
        <button type="button" onClick={openLogin} className="w-full flex items-center justify-center gap-space-sm px-space-md py-2 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-colors">
          <Icon n="login" className="text-[18px]" />Log in
        </button>
      ) : (
        <>
          {open && (
            <div className="absolute bottom-full left-0 right-0 mb-space-sm bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-lg p-space-sm flex flex-col gap-0.5">
              <div className="px-space-md py-space-sm">
                <div className="font-body-sm text-body-sm font-semibold capitalize truncate">{user.name}</div>
                <div className="font-label-sm text-label-sm text-on-surface-variant truncate">{user.email}</div>
              </div>
              <div className="mx-space-sm mb-space-xs p-space-md rounded-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-body-sm text-body-sm font-semibold">Pro plan</span>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-fixed-variant">Active</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Renews Nov 27, 2026</span>
              </div>
              <a href="#" className={item}><Icon n="credit_card" className="text-[18px]" />Manage subscription</a>
              <a href="#" className={item}><Icon n="person" className="text-[18px]" />Profile</a>
              <a href="#" className={item}><Icon n="settings" className="text-[18px]" />Settings</a>
              <button type="button" onClick={signOut} className={item}><Icon n="logout" className="text-[18px]" />Log out</button>
            </div>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between gap-space-sm px-space-sm py-space-sm rounded-xl hover:bg-surface-container-high transition-colors">
            <span className="flex items-center gap-space-sm min-w-0">
              <span className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-sm text-label-sm font-semibold uppercase shrink-0">{user.name.slice(0, 2)}</span>
              <span className="flex flex-col text-left min-w-0">
                <span className="font-body-sm text-body-sm font-semibold leading-tight capitalize truncate">{user.name}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">Pro</span>
              </span>
            </span>
            <Icon n="unfold_more" className="text-[16px] text-outline" />
          </button>
        </>
      )}

      {login && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-space-lg" onMouseDown={(e) => e.target === e.currentTarget && setLogin(false)}>
          <form onSubmit={signIn} className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-lg p-space-lg sm:p-space-xl flex flex-col gap-space-lg">
            <div>
              <h2 className="font-headline-md text-headline-md tracking-tight">{signup ? "Create your Recall account" : "Log in to Recall"}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Your cards stay on this device and sync to your account when you’re online.</p>
            </div>
            <button type="button" onClick={google} disabled={busy} className="w-full flex items-center justify-center gap-space-sm py-2 border border-outline-variant/60 rounded-xl font-medium hover:bg-surface-container-high transition-colors disabled:opacity-60">
              <svg viewBox="0 0 48 48" className="w-[18px] h-[18px]" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-outline">
              <span className="flex-1 h-px bg-outline-variant/50" />or<span className="flex-1 h-px bg-outline-variant/50" />
            </div>
            {[["email", "Email", "email"], ["password", "Password", "password"]].map(([name, label, type]) => (
              <label key={name} className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
                {label}
                <input name={name} type={type} required minLength={name === "password" ? 6 : undefined} autoComplete={name === "email" ? "email" : signup ? "new-password" : "current-password"} autoFocus={name === "email"} className="px-space-md py-2 bg-surface border border-outline-variant/50 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container" />
              </label>
            ))}
            {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
            <div className="flex gap-space-sm">
              <button type="button" onClick={() => setLogin(false)} className="flex-1 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
              <button type="submit" disabled={busy} className="flex-1 py-2 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-medium transition-colors disabled:opacity-60">{signup ? "Create account" : "Log in"}</button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
              {signup ? "Already have an account?" : "New to Recall?"}{" "}
              <button type="button" onClick={() => { setSignup((v) => !v); setError(""); }} className="text-primary font-medium hover:underline">{signup ? "Log in" : "Create an account"}</button>
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
