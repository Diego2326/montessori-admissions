"use client";
import { invalidateOperationCache } from "@/lib/operations/client";

export function SignOutButton() {
  return <button className="signout-button" type="button" onClick={async () => {
    invalidateOperationCache();
    await fetch("/api/session", { method: "DELETE" });
    window.location.assign("/login");
  }}>Cerrar sesión</button>;
}
