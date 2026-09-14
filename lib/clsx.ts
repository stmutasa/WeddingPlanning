/** Tiny classnames joiner so we don't need an extra dependency for this. */
export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
