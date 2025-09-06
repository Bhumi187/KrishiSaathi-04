/* Minimal IndexedDB wrapper (optional) + simple key-value helpers.
   For hackathon speed we default to localStorage; drop-in hooks kept for later. */

window.DB = {
  async set(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  },
  async get(key, fallback=null){
    try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch{ return fallback; }
  },
  async remove(key){ localStorage.removeItem(key); }
};
