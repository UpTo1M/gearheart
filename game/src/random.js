// Gearheart — a tiny seeded random source (mulberry32), so a level and a
// screenshot scene can be replayed exactly from one number.
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * max);
    },
    pick(array) {
      return array[this.int(array.length)];
    },
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = this.int(i + 1);
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
  };
}
