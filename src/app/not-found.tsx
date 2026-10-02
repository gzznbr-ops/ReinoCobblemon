import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card max-w-sm p-8 text-center">
        <p className="heading text-gold-gradient text-6xl">404</p>
        <p className="mt-2 text-sm text-stone-400">Esta página não existe no Reino Cobblemon.</p>
        <Link href="/" className="btn-secondary mt-6">
          Voltar aos torneios
        </Link>
      </div>
    </main>
  );
}
