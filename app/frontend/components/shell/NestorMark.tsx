// The Cairn, inlined from brand/mark/. Keep this file and the four SVGs in
// brand/mark/ on the same geometry: they are separate copies of one drawing.
//
// Three courses hold down to about 20px. Below that the gaps close up, so the
// small variant drops to two courses, which is what brand/mark/mark-16.svg is
// for. Never apply a CSS invert filter: it destroys the green.

/** Three courses: 24px and above. */
const CHEVRON_3 = "M12 3 18.5 9.5h-3L12 6l-3.5 3.5h-3z";
const BLOCKS_3 =
  "M7.5 11h9v3h-9zM2.75 15.2h8.5v3h-8.5zM12.75 15.2h8.5v3h-8.5zM1 19.4h6.3v3h-6.3zM8.85 19.4h6.3v3h-6.3zM16.7 19.4h6.3v3h-6.3z";

/** Two courses, heavier: below 20px. */
const CHEVRON_2 = "M12 3 19 10h-3.2L12 6.2 8.2 10H5z";
const BLOCKS_2 = "M6.5 12.5h11v4h-11zM2 18h9v4h-9zM13 18h9v4h-9z";

function Cairn({
  size,
  chevron,
  blocks,
}: {
  size: number;
  chevron: string;
  blocks: string;
}) {
  const small = size < 20;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="Nestor"
    >
      <path fill={chevron} d={small ? CHEVRON_2 : CHEVRON_3} />
      <path fill={blocks} d={small ? BLOCKS_2 : BLOCKS_3} />
    </svg>
  );
}

/**
 * For Dark Purple surfaces. Keeps signature CPX Green: it carries 10.8:1 on
 * `#1E1847`, so on a dark ground the brand green is the right green.
 */
export function NestorMarkReverse({ size = 24 }: { size?: number }) {
  return <Cairn size={size} chevron="#4CEE76" blocks="#FFFFFF" />;
}

/**
 * For white and light surfaces. The chevron carries green-800, the contrast
 * green the brand defines for exactly this case: `#4CEE76` is 1.5:1 on white,
 * which is why the light mark used to need a Dark Purple tile behind it.
 */
export function NestorMarkPrimary({ size = 24 }: { size?: number }) {
  return <Cairn size={size} chevron="#0F7E33" blocks="#1E1847" />;
}
