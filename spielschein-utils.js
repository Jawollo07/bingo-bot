export const REQUIRED_SPIELSCHEINE = 4;

export function selectSpielscheine(spiele) {
    if (!Array.isArray(spiele)) throw new TypeError("Spielscheine müssen als Array übergeben werden.");
    if (spiele.length < REQUIRED_SPIELSCHEINE) return null;
    return spiele.slice(0, REQUIRED_SPIELSCHEINE);
}
