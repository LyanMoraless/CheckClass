export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p role="status">{label}</p>;
}
