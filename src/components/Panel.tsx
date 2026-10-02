/** Painel com moldura dourada e faixa carmesim no topo (mesmo estilo do site do servidor). */
export function Panel({
  title,
  children,
  className = "",
  id,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card relative mt-4 px-4 pb-6 pt-9 sm:px-6 ${className}`}>
      <div className="absolute -top-4 left-1/2 max-w-[90%] -translate-x-1/2">
        <h2 className="ribbon">{title}</h2>
      </div>
      {children}
    </section>
  );
}
