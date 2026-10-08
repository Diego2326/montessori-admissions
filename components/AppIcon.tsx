import type { SVGProps } from "react";

type IconName =
  | "spark"
  | "users"
  | "book"
  | "shirt"
  | "wallet"
  | "search"
  | "arrow"
  | "check"
  | "box"
  | "receipt"
  | "clock"
  | "plus"
  | "close";
const paths: Record<IconName, React.ReactNode> = {
  spark: (
    <>
      <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" />
      <path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2H3Z" />
      <path d="M17 11a3 3 0 0 0 0-6M17 15a5 5 0 0 1 4 5" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H21v18H6.5A2.5 2.5 0 0 1 4 17.5v-13Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H21M8 6h9M8 10h7" />
    </>
  ),
  shirt: <path d="m8 3 4 2 4-2 5 4-3 4-2-1v11H8V10l-2 1-3-4 5-4Z" />,
  wallet: (
    <>
      <rect x="2" y="5" width="20" height="15" rx="3" />
      <path d="M2 9h20M16 14h3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  box: (
    <>
      <path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="M5 5 19 19M19 5 5 19" />,
};
export function AppIcon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
