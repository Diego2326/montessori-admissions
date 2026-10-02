import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inscripciones 2027 | Colegio Bilingüe Montessori",
  description: "Espacio de trabajo para la reinscripción y admisión del ciclo 2027.",
  icons: {
    icon: "/logo-colegio.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
