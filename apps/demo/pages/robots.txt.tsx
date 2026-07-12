// Prerendered robots.txt.
//
// zfb filename convention: robots.txt.tsx → dist/robots.txt.
// `contentType` pins the dev-server Content-Type to text/plain.
//
// Unlike the reference this shell is adapted from (a password-gated design
// prototype that disallowed all crawling), this demo deploys publicly, so it
// allows crawling by default.

export const frontmatter = { title: "Robots" };
export const contentType = "text/plain";

export default function Robots(): string {
  return `User-agent: *\nAllow: /\n`;
}
