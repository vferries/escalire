export interface EventEntry {
  id: string;
  data: {
    date: Date;
    published: boolean;
    [key: string]: unknown;
  };
}

type Partitionable = { data: { date: Date; published: boolean } };

export function partitionEvents<T extends Partitionable>(events: T[], now: Date): { upcoming: T[]; past: T[] } {
  const published = events.filter((e) => e.data.published);
  const upcoming = published
    .filter((e) => e.data.date.getTime() >= now.getTime())
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
  const past = published
    .filter((e) => e.data.date.getTime() < now.getTime())
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return { upcoming, past };
}
