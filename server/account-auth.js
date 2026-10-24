import {
  createHash,
  createHmac,
  randomUUID,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE = "clarity_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const MAX_SIGNUPS_PER_WINDOW = 10;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_HASH = `scrypt$${Buffer.alloc(16, 19).toString("base64url")}$${Buffer.alloc(64, 37).toString("base64url")}`;
const normalizeUsername = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const passwordBytes = password => Buffer.byteLength(password, "utf8");
const sha256 = token => createHash("sha256").update(token).digest("hex");

function requestAddress(req) {
  const address = String(req.ip || req.socket.remoteAddress || "unknown").trim().slice(0, 200);
  return address;
}

function protectedKey(secret, type, value) {
  return createHmac("sha256", secret).update(`${type}:${value}`).digest("hex");
}

function cookieToken(req) {
  const value = (req.get("cookie") || "").split(";").map(piece => piece.trim())
    .find(piece => piece.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

function isSameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const forwardedHost = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const forwardedProtocol = (req.get("x-forwarded-proto") || req.protocol || "").split(",")[0].trim();
    return new URL(origin).origin === `${forwardedProtocol}://${forwardedHost}`;
  } catch { return false; }
}

function writeSessionCookie(req, res, token) {
  const isSecure = process.env.NODE_ENV !== "test" &&
    (req.secure || (req.get("x-forwarded-proto") || "").split(",")[0].trim() === "https");
  res.append("Set-Cookie", `${COOKIE}=${token}; Max-Age=${Math.floor(SESSION_MS / 1000)}; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`);
}

function clearSessionCookie(req, res) {
  const isSecure = process.env.NODE_ENV !== "test" &&
    (req.secure || (req.get("x-forwarded-proto") || "").split(",")[0].trim() === "https");
  res.append("Set-Cookie", `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`);
}

async function passwordHash(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(key).toString("base64url")}`;
}

async function passwordMatches(password, encoded) {
  const match = /^scrypt\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/.exec(encoded || "");
  const salt = match ? Buffer.from(match[1], "base64url") : Buffer.alloc(16, 19);
  const expected = match ? Buffer.from(match[2], "base64url") : Buffer.alloc(64, 37);
  const actual = Buffer.from(await scrypt(password, salt, 64, SCRYPT_OPTIONS));
  return !!match && expected.length === actual.length && timingSafeEqual(actual, expected);
}

function sessionUser(user) { return user ? { username: user.username } : null; }

function noStore(res) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
}

export function createAccountSessionMiddleware(db) {
  return async function accountSessionMiddleware(req, res, next) {
    req.localUserId = null;
    req.localUsername = null;
    const token = cookieToken(req);
    if (!token) return next();
    if (!db) {
      noStore(res);
      return res.status(503).json({ error: "Account storage is unavailable. Please try again later." });
    }
    try {
      const { rows } = await db.query(`
        SELECT u.id, u.username
        FROM clarity_auth_sessions s
        JOIN clarity_auth_users u ON u.id = s.user_id
        WHERE s.session_hash = $1 AND s.expires_at > NOW()
      `, [sha256(token)]);
      if (rows[0]) {
        req.localUserId = `local:${rows[0].id}`;
        req.localUsername = rows[0].username;
      } else {
        await db.query("DELETE FROM clarity_auth_sessions WHERE session_hash = $1 AND expires_at <= NOW()", [sha256(token)]);
      }
      return next();
    } catch {
      noStore(res);
      return res.status(503).json({ error: "Couldn't check your sign-in. Please try again." });
    }
  };
}

export function registerAccountAuth(app, { db, sessionSecret = process.env.SESSION_SECRET } = {}) {
  const sessionMiddleware = createAccountSessionMiddleware(db);
  const unavailable = res => {
    noStore(res);
    return res.status(503).json({ error: "Accounts aren't available right now. Please try again later." });
  };
  const csrf = (req, res, next) => {
    if (!isSameOrigin(req)) {
      noStore(res);
      return res.status(403).json({ error: "This request couldn't be verified. Reload the page and try again." });
    }
    next();
  };
  const getIdentityKeys = (req, username) => [
    protectedKey(sessionSecret, "login-ip", requestAddress(req)),
    ...(username ? [protectedKey(sessionSecret, "username", username)] : []),
  ];

  async function blocked(dbConn, keys, limit = MAX_LOGIN_FAILURES) {
    const { rows } = await dbConn.query(
      "SELECT limit_key, failure_count, window_started_at FROM clarity_auth_login_limits WHERE limit_key = ANY($1::text[])",
      [keys],
    );
    return rows.filter(row => Number(row.failure_count) >= limit &&
      Date.now() - new Date(row.window_started_at).getTime() < LOGIN_WINDOW_MS);
  }

  async function recordFailure(dbConn, keys) {
    for (const key of keys) {
      await dbConn.query(`
        INSERT INTO clarity_auth_login_limits(limit_key, failure_count, window_started_at)
        VALUES($1, 1, NOW())
        ON CONFLICT(limit_key) DO UPDATE SET
          failure_count = CASE
            WHEN clarity_auth_login_limits.window_started_at <= NOW() - INTERVAL '15 minutes' THEN 1
            ELSE clarity_auth_login_limits.failure_count + 1
          END,
          window_started_at = CASE
            WHEN clarity_auth_login_limits.window_started_at <= NOW() - INTERVAL '15 minutes' THEN NOW()
            ELSE clarity_auth_login_limits.window_started_at
          END
      `, [key]);
    }
  }

  async function clearFailures(dbConn, keys) {
    await dbConn.query("DELETE FROM clarity_auth_login_limits WHERE limit_key = ANY($1::text[])", [keys]);
  }

  function tooManyAttempts(res, rows) {
    const remaining = Math.max(...rows.map(row =>
      Math.ceil((new Date(row.window_started_at).getTime() + LOGIN_WINDOW_MS - Date.now()) / 1000),
    ));
    res.set("Retry-After", String(Math.max(1, remaining)));
    noStore(res);
    return res.status(429).json({ error: "Too many attempts. Wait a little while before trying again." });
  }

  async function newSession(dbConn, userId, res, req) {
    const token = randomBytes(32).toString("base64url");
    const previous = cookieToken(req);
    if (previous) await dbConn.query("DELETE FROM clarity_auth_sessions WHERE session_hash=$1", [sha256(previous)]);
    await dbConn.query(
      "INSERT INTO clarity_auth_sessions(session_hash,user_id,expires_at) VALUES($1,$2,$3)",
      [sha256(token), userId, new Date(Date.now() + SESSION_MS).toISOString()],
    );
    writeSessionCookie(req, res, token);
  }

  app.post("/api/auth/register", csrf, async (req, res) => {
    noStore(res);
    if (!db || !sessionSecret || sessionSecret.length < 32) return unavailable(res);
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation : "";
    if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
      return res.status(400).json({ error: "Use a username with 3–24 letters, numbers, dots, dashes or underscores." });
    }
    if (password.length < 12 || passwordBytes(password) > 1024) {
      return res.status(400).json({ error: "Use a password of at least 12 characters." });
    }
    if (password !== confirmation) {
      return res.status(400).json({ error: "Those passwords don't match. Check and try again." });
    }
    const keys = [protectedKey(sessionSecret, "signup-ip", requestAddress(req))];
    let dbConn = db, client, transactionStarted = false;
    try {
      if (typeof db.connect === "function") {
        client = await db.connect();
        dbConn = client;
      }
      const attempt = await blocked(dbConn, keys, MAX_SIGNUPS_PER_WINDOW);
      if (attempt.length) {
        if (client) client.release();
        return tooManyAttempts(res, attempt);
      }
      await recordFailure(dbConn, keys);
      const encoded = await passwordHash(password);
      await dbConn.query("BEGIN");
      transactionStarted = true;
      const result = await dbConn.query(
        "INSERT INTO clarity_auth_users(id,username,password_hash) VALUES($1,$2,$3) RETURNING id,username",
        [randomUUID(), username, encoded],
      );
      await newSession(dbConn, result.rows[0].id, res, req);
      await dbConn.query("COMMIT");
      transactionStarted = false;
      if (client) client.release();
      noStore(res);
      return res.status(201).json({ user: sessionUser(result.rows[0]) });
    } catch (error) {
      if (transactionStarted) { try { await dbConn.query("ROLLBACK"); } catch {} }
      if (client) client.release();
      if (error.code === "23505") return res.status(409).json({ error: "That username is already in use. Choose another one." });
      console.error("Account registration failed:", error.code || "storage_error");
      return unavailable(res);
    }
  });

  app.post("/api/auth/login", csrf, async (req, res) => {
    noStore(res);
    if (!db || !sessionSecret || sessionSecret.length < 32) return unavailable(res);
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username) || !password || passwordBytes(password) > 1024) {
      return res.status(401).json({ error: "Username or password doesn't match." });
    }
    const keys = getIdentityKeys(req, username);
    try {
      const attempt = await blocked(db, keys);
      if (attempt.length) return tooManyAttempts(res, attempt);
      await recordFailure(db, keys);
      const result = await db.query(
        "SELECT id,username,password_hash FROM clarity_auth_users WHERE username=$1 LIMIT 1",
        [username],
      );
      const user = result.rows[0];
      const valid = await passwordMatches(password, user?.password_hash || DUMMY_HASH);
      if (!user || !valid) {
        return res.status(401).json({ error: "Username or password doesn't match." });
      }
      await clearFailures(db, keys);
      await newSession(db, user.id, res, req);
      return res.json({ user: sessionUser(user) });
    } catch (error) {
      console.error("Account sign-in failed:", error.code || "storage_error");
      return unavailable(res);
    }
  });

  app.get("/api/auth/me", sessionMiddleware, (req, res) => {
    noStore(res);
    res.json({ user: req.localUserId ? { username: req.localUsername } : null });
  });

  app.post("/api/auth/logout", csrf, async (req, res) => {
    noStore(res);
    const token = cookieToken(req);
    try {
      if (db && token) await db.query("DELETE FROM clarity_auth_sessions WHERE session_hash=$1", [sha256(token)]);
      clearSessionCookie(req, res);
      return res.json({ signedOut: true });
    } catch (error) {
      console.error("Account sign-out failed:", error.code || "storage_error");
      return unavailable(res);
    }
  });

  return { sessionMiddleware };
}
