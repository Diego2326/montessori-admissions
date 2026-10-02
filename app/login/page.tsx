import Image from "next/image";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return <main className="login-page"><div className="login-card">
    <div className="login-brand"><Image src="/logo-colegio.png" width={54} height={54} alt="Colegio Bilingüe Montessori" /><span><strong>Montessori</strong><small>Gestión de admisiones</small></span></div>
    <p className="eyebrow">Ciclo escolar 2027</p><h1>Bienvenido de <em>vuelta.</em></h1>
    <p className="login-description">Ingresa con tu cuenta del colegio para revisar los expedientes de inscripción.</p>
    <LoginForm />
  </div><div className="login-aside"><span>Admisiones 2027</span><h2>Un proceso claro para cada familia.</h2><p>Datos, contrato, firma y pago en un mismo recorrido.</p></div></main>;
}
