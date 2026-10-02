import Image from "next/image";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return <main className="login-page"><div className="login-card">
    <div className="login-brand"><Image src="/logo-colegio.png" width={58} height={58} alt="Escudo del Colegio Bilingüe Montessori Zacapa" /><span><strong>Montessori</strong><small>Zacapa</small></span></div>
    <div className="login-heading"><p className="eyebrow">Inscripciones · 2027</p><h1>Iniciar sesión</h1></div>
    <LoginForm />
  </div></main>;
}
