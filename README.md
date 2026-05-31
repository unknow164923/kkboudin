# 🤖 Bot Discord — Commandes Clés en Main

## ⚙️ Installation

### 1. Prérequis
- Node.js 18+ installé → https://nodejs.org
- Un bot Discord créé sur https://discord.com/developers/applications

### 2. Créer ton bot Discord
1. Va sur https://discord.com/developers/applications → **New Application**
2. Onglet **Bot** → **Reset Token** → copie le token
3. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot` + `applications.commands`
   - Bot permissions : `Manage Channels`, `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`
4. Copie l'URL générée et invite le bot sur ton serveur

### 3. Activer les Intents
Dans l'onglet **Bot** → active :
- ✅ PRESENCE INTENT
- ✅ SERVER MEMBERS INTENT
- ✅ MESSAGE CONTENT INTENT

### 4. Récupérer les IDs nécessaires
Active le **mode développeur** dans Discord (Paramètres → Avancé → Mode développeur)
Puis fais clic droit sur :
- Ton serveur → "Copier l'ID" → `GUILD_ID`
- Toi-même → "Copier l'ID" → `OWNER_ID`
- La catégorie où Ticket Tool crée les tickets → "Copier l'ID" → `TICKET_CATEGORY_ID`
- Ta catégorie "fiche client" → "Copier l'ID" → `FICHE_CATEGORY_ID`
- Le salon "ouvrir un ticket" → "Copier l'ID" → `OPEN_TICKET_CHANNEL_ID`

### 5. Configurer le bot
Ouvre `index.js` et remplis le bloc CONFIG au début du fichier :

```js
const CONFIG = {
  TOKEN: 'TON_TOKEN_ICI',
  GUILD_ID: '123456789',
  TICKET_CATEGORY_ID: '123456789',
  FICHE_CATEGORY_ID: '123456789',
  OWNER_ID: '123456789',
  OPEN_TICKET_CHANNEL_ID: '123456789',
};
```

### 6. Lancer le bot
```bash
npm install
npm start
```

---

## 🚀 Héberger gratuitement (24/7)

### Option A — Railway (recommandé)
1. Crée un compte sur https://railway.app
2. New Project → Deploy from GitHub (upload ton dossier)
3. Ajoute une variable d'environnement `TOKEN` avec ton token
4. Le bot tourne 24/7 gratuitement (500h/mois offerts)

### Option B — Render
1. Crée un compte sur https://render.com
2. New → Web Service → connecte ton repo GitHub
3. Build Command : `npm install`
4. Start Command : `node index.js`
5. Variables d'environnement : ajoute `TOKEN`

---

## 🔄 Comment ça fonctionne

1. Client ouvre un ticket via Ticket Tool
2. Le bot détecte la création du salon dans la catégorie tickets
3. Le bot envoie un menu déroulant **"Choix du pack"**
4. Selon le pack :
   - **Basic** : pack → paiement → description → fiche créée
   - **Pro/Premium** : pack → paiement → bots → catégories → salons → rôles → description → fiche créée
5. Un salon `fiche-pseudo` est créé automatiquement dans ta catégorie "fiche client"
6. L'embed de fiche apparaît avec les boutons ✅ Accepter / ❌ Refuser

---

## ⚠️ Limitation Discord sur les modals
Discord limite les modals à **5 champs max**. Pour les bots, catégories, salons et rôles, le bot affiche jusqu'à 5 entrées par modal. Si un client veut plus de 5 bots par exemple, dis-lui de le préciser dans la description.
