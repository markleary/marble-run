interface MarbleIdentity { name: string; color: string }
interface Score extends MarbleIdentity { wins: number; points: number }
const winPrefix = 'marble-run:win:v1:';
const finishPrefix = 'marble-run:finish:v1:';

export function normalizedName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 18);
}

export function finishPoints(index: number) {
  return [3, 2, 1][index] ?? 0;
}

export class Standings {
  private session = new Map<string, MarbleIdentity[]>();

  constructor(private colors: string[]) {}

  record(raceId: string, finish: MarbleIdentity[]) {
    if (this.session.has(raceId)) return;
    const order = finish.map(({ name, color }) => ({ name, color }));
    this.session.set(raceId, order);
    try {
      // One record per completed heat keeps simultaneous tabs and repeated results idempotent.
      localStorage.setItem(finishPrefix + raceId, JSON.stringify(order));
    } catch { /* Standings remain available for this session. */ }
  }

  totals(): Score[] {
    const races = new Map(this.session);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const legacy = key.startsWith(winPrefix);
        if (!legacy && !key.startsWith(finishPrefix)) continue;
        const raceId = key.slice((legacy ? winPrefix : finishPrefix).length);
        if (legacy && races.has(raceId)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) ?? 'null');
          // Older versions recorded only first place.
          const order = legacy ? [value] : value;
          if (Array.isArray(order) && order.length > 0 && order.length <= 6 &&
              order.every(m => m && typeof m.name === 'string' && this.colors.includes(m.color))) {
            races.set(raceId, order);
          }
        } catch { /* Skip malformed records individually. */ }
      }
    } catch { /* Storage can be unavailable in private sessions. */ }
    const scores = new Map<string, Score>();
    for (const order of races.values()) {
      order.forEach(({ name, color }, index) => {
        const key = color + '/' + normalizedName(name).toLowerCase();
        const score = scores.get(key) ?? { name, color, points: 0, wins: 0 };
        score.points += finishPoints(index);
        if (index === 0) score.wins++;
        scores.set(key, score);
      });
    }
    return [...scores.values()].sort((a, b) =>
      b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name) || a.color.localeCompare(b.color));
  }
}
