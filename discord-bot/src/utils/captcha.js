const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const store = new Map();

function generate(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function createCaptcha(userId) {
  const code = generate();
  store.set(userId, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
  return code;
}

function verifyCaptcha(userId, input) {
  const entry = store.get(userId);
  if (!entry) return { valid: false, reason: 'expired' };
  if (Date.now() > entry.expiresAt) {
    store.delete(userId);
    return { valid: false, reason: 'expired' };
  }
  if (input.toUpperCase().trim() !== entry.code) {
    return { valid: false, reason: 'wrong' };
  }
  store.delete(userId);
  return { valid: true };
}

function deleteCaptcha(userId) {
  store.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(userId);
  }
}, 60 * 1000);

module.exports = { createCaptcha, verifyCaptcha, deleteCaptcha };
