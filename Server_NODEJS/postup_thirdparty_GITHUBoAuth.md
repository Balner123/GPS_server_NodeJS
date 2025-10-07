# Postup: Přidání přihlášení pomocí GitHub (GitHub OAuth)

Tento dokument popisuje postup pro přidání přihlášení přes GitHub k již existující implementaci Google OAuth. Využijeme stávající infrastrukturu (Passport.js, upravenou DB a model).

Cíl: Rychle a efektivně přidat dalšího poskytovatele přihlášení.

## Hlavní kroky a rozhodnutí
- Implementujeme GitHub OAuth pomocí strategie `passport-github2`.
- Databáze v `init-db.sql` je již připravena a **nevyžaduje žádné změny**.
- Upravíme Sequelize model `models/user.js`, aby obsahoval chybějící pole (`provider`, `provider_id`, `provider_data`).
- Přidáme GitHub strategii do stávajícího konfiguračního souboru `config/passport.js`.
- Přidáme nové routy pro GitHub do `routes/auth.oauth.js`.
- Policy pro propojování účtů (linking) bude stejná jako u Google: automatické propojení, pokud se shoduje e-mail (GitHub neposkytuje flag `verified` tak jednoduše jako Google, takže primárně budeme spoléhat na existenci e-mailu).

## 1. Instalace balíčku
Nainstalujte `passport-github2` pomocí PowerShellu v kořenové složce projektu:

```powershell
npm install passport-github2
```

## 2. Potřebné .env proměnné
Přidejte do vašeho `.env` souboru klíče, které jste získal z nastavení vaší GitHub OAuth App:

```
GITHUB_CLIENT_ID=VAS_GUTHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=VAS_GITHUB_CLIENT_SECRET
GITHUB_CALLBACK_URL=https://lotr-system.xyz/auth/github/callback
```
*Poznámka: `GITHUB_CALLBACK_URL` musí přesně odpovídat tomu, co jste nastavil v GitHub aplikaci.*

## 3. Úprava modelu (`models/user.js`)
**Toto je důležitý krok k nápravě nesrovnalosti.** Otevřete `models/user.js` a doplňte definici modelu `User` o chybějící sloupce, aby odpovídala databázi:

```javascript
// ... uvnitř sequelize.define('User', { ... })
    // ... za polem pending_email
    pending_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'local'
    },
    provider_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider_data: {
      type: DataTypes.TEXT,
      allowNull: true
    }
// ... zbytek souboru
```

## 4. Rozšíření Passport konfigurace (`config/passport.js`)
Otevřete `config/passport.js` a přidejte GitHub strategii vedle té stávající pro Google.

```javascript
// na začátek souboru přidejte
const GitHubStrategy = require('passport-github2').Strategy;

// ... za passport.use(new GoogleStrategy(...)); přidejte:

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
  scope: ['user:email'] // Důležité pro získání e-mailu
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;

    // 1) Najít uživatele podle provider + provider_id
    let user = await db.User.findOne({ where: { provider: 'github', provider_id: providerId } });

    // 2) Pokud nenalezen, zkusit najít podle e-mailu
    if (!user && email) {
      user = await db.User.findOne({ where: { email: email } });
      if (user) {
        // E-mail se shoduje, propojíme účet
        await user.update({ provider: 'github', provider_id: providerId, provider_data: JSON.stringify(profile) });
      }
    }

    // 3) Pokud stále nenalezen, vytvořit nového uživatele
    if (!user) {
      // GitHub neposkytuje spolehlivý display name, username je lepší
      const username = profile.username || `github_${providerId}`;
      user = await db.User.create({
        username: username,
        email: email,
        password: '', // Žádné lokální heslo
        provider: 'github',
        provider_id: providerId,
        provider_data: JSON.stringify(profile),
        is_verified: !!email // Pokud máme email, považujeme za ověřeného
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));
```

## 5. Rozšíření Rout (`routes/auth.oauth.js`)
Otevřete `routes/auth.oauth.js` a přidejte dvě nové routy pro GitHub:

```javascript
// ... za router.get('/google/callback', ...);

// Routy pro GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
  // Stejná logika jako u Google pro zachování kompatibility
  req.session.isAuthenticated = true;
  req.session.user = { id: req.user.id, username: req.user.username, email: req.user.email };
  res.redirect('/');
});
```

## 6. UI - Přidání tlačítka
Do `views/login.ejs` přidejte tlačítko pro přihlášení přes GitHub:

```ejs
<a href="/auth/github" class="btn btn-github">Přihlásit přes GitHub</a>
```
*Doporučuji přidat styl pro `.btn-github` do vašeho CSS souboru.*

## Checklist implementace
- [ ] `npm install passport-github2`
- [ ] Doplnit `.env` o `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`.
- [ ] Upravit `models/user.js` a přidat chybějící pole.
- [ ] Upravit `config/passport.js` a přidat `GitHubStrategy`.
- [ ] Upravit `routes/auth.oauth.js` a přidat routy pro GitHub.
- [ ] Upravit `views/login.ejs` a přidat tlačítko pro GitHub.
- [ ] Otestovat funkčnost.

---
Pokud chcete, mohu tyto změny (kromě `.env`) provést automaticky. Stačí říct.