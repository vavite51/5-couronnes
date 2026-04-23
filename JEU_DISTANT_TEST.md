# Jeu Distant (Phase Test - Hote Joueur)

Ce projet est separe du compteur original et sert a tester le jeu a distance:
- un joueur lance le serveur local (`host-server.js`)
- tous les joueurs se connectent dessus avec l'application

## 1) Lancer le serveur hote (local)

```bash
npm run host:test
```

Par defaut:
- port: `8787`
- timer par tour: `120s`

Variables optionnelles:

```powershell
$env:PORT=8787
$env:TURN_SECONDS=120
npm run host:test
```

## 2) Connexion des joueurs

Dans l'app:
1. Renseigner pseudo + URL WebSocket (`ws://IP_HOTE:8787`).
2. L'hote clique `Creer une salle` et partage le code.
3. Les autres cliquent `Rejoindre` avec le code.
4. L'hote demarre la partie.

## 3) Limites de la phase test

- Pas de compte.
- Pas de reprise de session persistante.
- Si le joueur hote coupe son serveur local, la partie s'arrete.

## 4) Mode Debug (bots)

Dans le lobby, l'hote peut:
1. choisir un nombre de bots debug,
2. cliquer `Ajouter bots debug`,
3. demarrer la partie pour simuler une table multi-joueurs.

Les bots jouent automatiquement quand c'est leur tour.

## 5) Deploiement internet (Render gratuit)

Prerequis:
1. Le repo GitHub contient bien ce projet.
2. Dans Render: `New Web Service` puis selection du repo.

Parametres Render:
1. Runtime: `Node`
2. Build Command: `npm ci`
3. Start Command: `npm run host:test`
4. Plan: `Free`
5. Environment Variable: `TURN_SECONDS=120`

Si `render.yaml` est detecte, Render remplit ces valeurs automatiquement.

URL WebSocket a mettre dans l'app:
- si Render donne `https://xxxxx.onrender.com`
- alors utiliser `wss://xxxxx.onrender.com/ws`

Verification rapide:
1. Ouvrir `https://xxxxx.onrender.com/health` (doit renvoyer un JSON `ok: true`).
2. Dans l'app, mode internet, coller `wss://xxxxx.onrender.com/ws`.
3. Creer la salle depuis le telephone hote, partager le code salle.
