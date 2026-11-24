import type { Metadata } from "next";
import "./globals.css";
import "./operations.css";
import "./forms.css";
import "./web-montessori.css";

export const metadata: Metadata = {
  title: "Inscripciones 2027 | Colegio Bilingüe Montessori",
  description:
    "Espacio de trabajo para la reinscripción y admisión del ciclo 2027.",
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
    <html lang="es" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
