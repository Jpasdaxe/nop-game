# 🎤 N'oubliez pas les paroles — Serveur

## Lancer en local

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Le serveur démarre sur **http://localhost:3001**

Teste que tout fonctionne :
```
GET http://localhost:3001/health
```

---

## Événements Socket.IO

### Côté HOST
| Émit               | Payload                              | Réponse                         |
|--------------------|--------------------------------------|---------------------------------|
| `room:create`      | `{ hostName }`                       | `{ success, code }`             |
| `game:start`       | `{ roomCode, song }`                 | `{ success }`                   |
| `game:end`         | `{ roomCode }`                       | —                               |

### Côté JOUEUR
| Émit               | Payload                              | Réponse                         |
|--------------------|--------------------------------------|---------------------------------|
| `room:join`        | `{ roomCode, playerName }`           | `{ success, state }`            |
| `game:answer`      | `{ roomCode, blankIndex, answer }`   | `{ correct, points }`           |

### Événements reçus (tous)
| Événement            | Données                              |
|----------------------|--------------------------------------|
| `room:updated`       | État complet de la room              |
| `room:closed`        | `{ reason }`                         |
| `game:roundStarted`  | `{ state, song, serverTime }`        |
| `game:scoresUpdated` | `{ scores, players }`                |
| `game:roundEnded`    | `{ scores, players, correctLyrics }` |

### WebRTC Signaling
| Émit            | Payload              |
|-----------------|----------------------|
| `webrtc:offer`  | `{ to, offer }`      |
| `webrtc:answer` | `{ to, answer }`     |
| `webrtc:ice`    | `{ to, candidate }`  |

---

## Structure d'une chanson

```json
{
  "title": "La Bamba",
  "artist": "Los Lobos",
  "audioUrl": "https://ton-stockage/la-bamba.mp3",
  "lyrics": [
    { "word": "Para", "isBlank": false },
    { "word": "bailar", "isBlank": true, "answer": "bailar" },
    { "word": "la", "isBlank": false },
    { "word": "bamba", "isBlank": true, "answer": "bamba" }
  ]
}
```

---

## Déploiement Railway

1. Crée un nouveau projet sur [railway.app](https://railway.app)
2. Connecte ce repo GitHub (ou `railway up` en CLI)
3. Ajoute un plugin **PostgreSQL** dans Railway
4. Configure la variable `CLIENT_URL` avec l'URL de ton frontend
5. Railway détecte `package.json` et lance `npm start` automatiquement
