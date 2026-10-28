import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";

// Values from Firebase console > Project settings > Your apps (web). Put them in .env.local.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
