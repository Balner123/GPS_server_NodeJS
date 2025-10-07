# Postup: Přihlášení pomocí Google (Google OAuth)

Tento dokument je aktualizovaný plán pro implementaci pouze Google OAuth (bez GitHubu). Podle domluvy upravíme DB přímo v `init-db.sql` (nepoužíváme migrační framework — data zatím nejsou v produkci).

Cíl: co nejmenší odpor — použít Passport.js a oficiální Google strategii, minimální změny v existujícím kódu a zachovat kompatibilitu se session-based autentizací.

## Hlavní rozhodnutí
- Implementujeme pouze Google OAuth.
- DB změny provedeme editací `init-db.sql` (přidáme `provider`, `provider_id`, `provider_data`).
- Po OAuth přihlášení použijeme `req.login()` a navíc nastavíme `req.session.isAuthenticated` a `req.session.user` tak, aby stávající middleware a kontrolery fungovaly.
- Policy linking: automatické propojení (auto-link) provádět pouze pokud Google vrací ověřený email (`email_verified`). Pokud email chybí nebo není verified, uživatele požádáme o doplnění/ruční link v nastavení.

## Co nainstalovat
PowerShell (ve složce projektu):

```powershell
npm install passport passport-google-oauth20
```

## Potřebné env proměnné
Přidejte do `.env` (neukládejte do repozitáře):

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL (např. https://lotr-system.xyz/auth/google/callback nebo HTTPS ngrok adresu)
- SESSION_SECRET (pokud ještě není)

## Úprava DB: `init-db.sql`
Otevřete `init-db.sql` a přidejte tyto sloupce do tabulky `users` (vložit v části, kde se definuje tabulka `users`):

```sql
ALTER TABLE users
  ADD COLUMN provider VARCHAR(50) DEFAULT 'local',
  ADD COLUMN provider_id VARCHAR(255),
  ADD COLUMN provider_data TEXT;
-- volitelně index pro rychlé vyhledávání
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider, provider_id);
```

Poznámka: protože používáte `init-db.sql` pouze při inicializaci DB, tato úprava je dostačující pro vývoj i nasazení, pokud DB znovu inicializujete.

## Passport konfigurace (soubor `config/passport.js`)
Vytvořte nový soubor `config/passport.js` s následující kostrou (upravit cesty podle projektu):

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../database');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    const emailObj = (profile.emails && profile.emails[0]) || null;

    // 1) najít podle provider + provider_id
    let user = await db.User.findOne({ where: { provider: 'google', provider_id: providerId } });

    // 2) pokud nenalezen, zkusit najít podle emailu
    if (!user && emailObj) {
      user = await db.User.findOne({ where: { email: emailObj.value } });
      if (user) {
        // pokud email je verified, můžeme auto-linkovat
        const emailVerified = emailObj.verified || (profile._json && profile._json.email_verified);
        if (emailVerified) {
          await user.update({ provider: 'google', provider_id: providerId, provider_data: JSON.stringify(profile), is_verified: true });
        } else {
          // necháme uživatele manuálně propojit (neautolinkujeme)
          return done(null, user); // nebo signalizovat potřebu linkování
        }
      }
    }

    // 3) pokud stále nenalezen, vytvořit nového uživatele
    if (!user) {
      const newUser = await db.User.create({
        username: profile.displayName || `google_${providerId}`,
        email: emailObj ? emailObj.value : null,
        password: '', // žádné lokální heslo
        provider: 'google',
        provider_id: providerId,
        provider_data: JSON.stringify(profile),
        is_verified: !!(emailObj && (emailObj.verified || (profile._json && profile._json.email_verified)))
      });
      return done(null, newUser);
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

module.exports = passport;
```

## Inicializace Passport v `server.js`
V `server.js` (nebo hlavním souboru) přidejte:

```javascript
const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());
```

## Routy (nový soubor `routes/auth.oauth.js`)
Vytvořte jednoduché routy:

```javascript
const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile','email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  // required for compatibility with existing code
  req.session.isAuthenticated = true;
  req.session.user = { id: req.user.id, username: req.user.username, email: req.user.email };
  res.redirect('/');
});

module.exports = router;
```

Nezapomeňte v `server.js` připojit routy, např. `app.use('/', require('./routes/auth.oauth'))`.

## UI
Do `views/login.ejs` vložte tlačítko:

```ejs
<a href="/auth/google" class="btn btn-google">Přihlásit přes Google</a>
```

## Testování lokálně pomocí ngrok
1. Spusťte server: `npm run dev`.
2. Spusťte ngrok: `ngrok http 3000`.
3. V Google Cloud Console zadejte jako Authorized redirect URI přesnou hodnotu, kterou ngrok vypíše, např. `https://abcd1234.ngrok.io/auth/google/callback`.

## Checklist implementace (rychle)
- [ ] Upravit `init-db.sql` (přidat sloupce provider, provider_id, provider_data).
- [ ] `npm install passport passport-google-oauth20`.
- [ ] Přidat `config/passport.js`.
- [ ] Upravit `server.js` pro `passport.initialize()` a `passport.session()`.
- [ ] Přidat `routes/auth.oauth.js` a připojit do aplikace.
- [ ] Upravit `views/login.ejs` (tlačítko Google).
- [ ] Otestovat přes ngrok a aktualizovat Google Console.

## Poznámky k bezpečnosti a policy
- Neautolinkovat účty jen na základě emailu, pokud email není verified (výjimka: explicitní volba auto-link v konfiguraci).
- V `.env` mít CLIENT_SECRET a nikdy ho commitovat.
- V produkci: HTTPS, `app.set('trust proxy', 1)` pokud jste za proxy, a `cookie.secure=true`.

---

Pokud chcete, mohu rovnou vytvořit soubory a upravit `init-db.sql` — napište, jestli chcete, abych to provedl automaticky (v tom případě označím příslušné todo jako in-progress a provedu patchy).
