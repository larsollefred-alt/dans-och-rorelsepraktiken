# Dans och Rörelsepraktiken – webbplats med Decap CMS

Webbplatsen för Jenny Davidsson (authenticmovement.se). Den är byggd med ren HTML, CSS och lite JavaScript. Jenny redigerar text, bilder och kontaktuppgifter själv på **/admin/**.

## Så fungerar det

```
content/            ← allt redigerbart innehåll (markdown). Ändras via /admin/
  hero.md             första sektionen: namn, rubrik, underrubrik, bakgrundsbild
  om-mig.md           Om mig: text, porträtt, fakta
  tjanster/*.md       en fil per tjänst: titel, bild, beskrivning, text
  mer-kunskap.md      texter/PDF:er
  kontakt.md          e-post, telefon, adress
  installningar.md    namn, Google-titel och beskrivning, logga, delningsbild
static/             ← kopieras rakt in på sajten
  admin/              Decap CMS (index.html + config.yml)
  images/uploads/     alla bilder (uppladdade via /admin/ hamnar här)
src/                ← utseende: styles.css och main.js (meny + formulär)
build.mjs           ← bygger content/ + src/ till färdiga HTML-sidor i dist/
```

När Jenny sparar i /admin/ skapas en commit i GitHub. Netlify kör då `npm run build` och publicerar `dist/`. Efter ungefär en minut syns ändringen på sajten. Bilder görs automatiskt om till lätta WebP-filer i flera storlekar.

## Engångsinställningar i Netlify

1. **Koppla sajten till GitHub-repot** om den inte redan är det: *Site configuration → Build & deploy → Link repository*. Bygginställningarna hämtas från `netlify.toml`: `npm run build`, mapp `dist`.
2. **Slå på Identity:** *Site configuration → Identity → Enable Identity*.
   - Under *Registration* väljer du **Invite only**, så att inga andra kan skapa konton.
3. **Slå på Git Gateway:** *Identity → Services → Git Gateway → Enable Git Gateway*.
4. **Bjud in Jenny:** *Identity → Invite users* och skriv `davidsson.jen@gmail.com`.
   - Hon får ett mejl, klickar på länken och väljer ett lösenord.
   - Sedan loggar hon in på **https://authenticmovement.se/admin/**.
5. **Bokningsformuläret:**
   - *Forms*: slå på form detection om den är av.
   - *Forms → Form notifications → Email*: ange formuläret `bokning` och Jennys e-post.
   - Hon kan svara direkt på mejlen.

> Repot måste ha grenen **main**. Heter den något annat, ändra `branch:` i `static/admin/config.yml`.

### Om Git Gateway

Netlify har markerat Git Gateway som *deprecated*. Det fungerar fortfarande, men får inga nya buggfixar. Det är ändå det enklaste för Jenny, eftersom hon bara behöver e-post och lösenord.

Om det någon gång slutar fungera kan inloggningen bytas till GitHub. Då behöver Jenny ett eget GitHub-konto med skrivrätt till repot, och Netlify-sajten en *OAuth provider* för GitHub. Bytet görs genom att ändra `backend` i `config.yml` till:

```yaml
backend:
  name: github
  repo: <ditt-github-namn>/<repo>
  branch: main
```

## Köra lokalt

```bash
npm install
npm run dev      # bygger och visar sajten på http://localhost:3000
npm run build    # bara bygga till dist/
```

/admin/ kräver Netlify Identity och fungerar därför bara på den publicerade sajten.
