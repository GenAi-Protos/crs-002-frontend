// Inline magnitude meter for a score inside a list row. The number beside it
// carries the value; the fill only gives it shape.

export function Meter({ value }: { value: number }) {
  return (
    <span className="relative inline-block h-2 w-16 bg-inset align-middle xl:w-24">
      <span
        className="absolute inset-y-0 left-0"
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          background: "var(--color-cat-1)",
        }}
      />
    </span>
  );
}
