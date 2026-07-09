import { describe, it, expect } from 'vitest';
import { epagineCoverUrl } from './epagine';

describe('epagineCoverUrl', () => {
  it("construit l'URL avec les 3 derniers chiffres comme dossier", () => {
    expect(epagineCoverUrl('9782283034873')).toBe(
      'https://images.epagine.fr/873/9782283034873_1_75.jpg'
    );
    expect(epagineCoverUrl('9782374912684')).toBe(
      'https://images.epagine.fr/684/9782374912684_1_75.jpg'
    );
  });
});
