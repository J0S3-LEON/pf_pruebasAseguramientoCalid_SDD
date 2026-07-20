import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MindFlow',
  description: 'Sistema de gestión cognitiva adaptativa para estudiantes',
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
