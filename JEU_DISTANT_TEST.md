# Jeu Distant (Phase Test - Hote Joueur)

Ce projet est separe du compteur original et sert a tester le jeu a distance:
- un joueur lance le serveur local (`host-server.js`)
- tous les joueurs se connectent dessus avec l'application

## 1) Lancer le serveur hote

```bash
npm run host:test
```

Par defaut:
- port: `8787`
- timer par tour: `45s`

Variables optionnelles:

```powershell
$env:PORT=8787
$env:TURN_SECONDS=45
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

## 5) Migration vers serveur dedie

Quand vous etes prets:
1. Deployer `host-server.js` sur un serveur public.
2. Passer les clients sur `wss://votre-domaine`.
3. Conserver le protocole actuel pour eviter de retoucher l'app.
