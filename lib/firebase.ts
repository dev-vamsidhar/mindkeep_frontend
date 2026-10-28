import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";

// Firebase web config is public by design (it identifies the project; access is enforced by Firebase Auth
// and by the API verifying ID tokens), so the project's values are built in and env vars only override them.
// That way a deploy works even when the build has no .env.local.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAKcP2e8yuP-UBKM11Y5YL56jUfo-flKI8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mindkeep-d374f.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mindkeep-d374f",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:852222205790:web:d6ca291a762cc77ffb39cf",
};

// Lazy so prerendering on the server never touches Firebase; call it from effects and handlers only.
export const auth = () => getAuth(getApps()[0] ?? initializeApp(config));

// Signed-in Firebase user for UI (name, email); null when signed out or not known yet.
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth(), setUser), []);
  return user;
}
export const displayName = (u: User | null) => u ? u.displayName || (u.email ?? "").split("@")[0].replace(/[._-]+/g, " ") : "";
