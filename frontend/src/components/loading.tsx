export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return <p role="status">{label}</p>;
}
