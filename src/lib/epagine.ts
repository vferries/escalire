export function epagineCoverUrl(isbn13: string): string {
  return `https://images.epagine.fr/${isbn13.slice(-3)}/${isbn13}_1_75.jpg`;
}
