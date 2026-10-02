"use client";

export function SignOutButton() {
  return <button className="signout-button" type="button" onClick={async () => {
    await fetch("/api/session", { method: "DELETE" });
    window.location.assign("/login");
  }}>Salir</button>;
}
