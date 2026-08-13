# Culture Parc, billetterie cinema

Plateforme de reservation en ligne pour les cinemas Culture Parc (Brazzaville,
Pointe-Noire, Ndjindji) : programme, choix de la place sur un plan de salle,
paiement Airtel Money ou MTN Mobile Money, billet PDF avec QR code, et controle
d'acces a l'entree.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) et **React 19**
- **TypeScript** de bout en bout
- **PostgreSQL** via **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS 4** pour la charte
- **Auth.js v5** pour les comptes et les roles
- `pdf-lib` et `qrcode` pour les billets

Aucun PHP, aucun Laravel : les integrations Airtel Money et MTN MoMo ont ete
reecrites en TypeScript.

## Demarrer

```bash
npm install
```

Copiez la configuration et renseignez-la :

```bash
cp .env.example .env
```

Deux valeurs sont a generer :

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # TICKET_QR_SECRET (exactement 64 caracteres hex)
```

Lancez une base PostgreSQL :

```bash
docker compose up -d
```

Puis appliquez le schema et les donnees de demonstration :

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Le site repond sur http://localhost:3000.

### Comptes de demonstration

| Role | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | admin@cultureparc.cg | CultureParc2026! |
| Controle d'acces | controle@cultureparc.cg | CultureParc2026! |

### Sans Docker

`npx prisma dev --name cultureparc --detach` lance un PostgreSQL local. Recuperez
l'URL TCP avec `npx prisma dev ls` et mettez `DATABASE_POOL_MAX="1"` dans `.env` :
ce serveur de developpement ne supporte pas les connexions concurrentes. Pour
tout test de charge ou de concurrence, utilisez Docker ou une base hebergee.

## Organisation

```
prisma/schema.prisma          Modele de donnees complet
prisma/seed.ts                Cinemas, salles, films, seances, tarifs de demo
src/lib/payments/             Airtel Money et MTN MoMo (clients HTTP + webhooks)
src/lib/pricing.ts            Resolution du prix d'une place
src/lib/seating.ts            Disponibilite et retenue temporaire des places
src/lib/booking.ts            Emission des billets apres paiement
src/lib/qr.ts                 Chiffrement et verification des QR codes
src/lib/scan.ts               Controle d'acces a l'entree
src/lib/ticket-pdf.ts         Billet imprimable
src/app/(pages publiques)     Accueil, films, programme, seance, commande
src/app/admin/                Back-office
src/app/scan/                 Poste de controle d'acces
```

## Points de conception

**Le 0 des numeros congolais.** Un numero s'ecrit +242 06 110 92 01 : l'indicatif
242 est suivi de neuf chiffres commencant par 0. Ce 0 ne se supprime jamais, y
compris au format international. Tout passe par `src/lib/phone.ts`.

**Montants entiers.** Le franc CFA n'a pas de sous-unite : aucun montant n'est
stocke en decimal, ce qui elimine les erreurs d'arrondi.

**Les billets naissent au paiement.** Tant que le paiement n'est pas confirme,
seules des retenues (`SeatHold`) existent. `finalizeBooking()` est idempotent :
le webhook de l'operateur et le suivi lance par le navigateur peuvent arriver
ensemble sans creer de doublon.

**L'unicite vient de la base.** Deux contraintes empechent de vendre deux fois la
meme place : `SeatHold @@unique([showtimeId, seatId])` et
`Ticket @@unique([showtimeId, seatId])`. Le code applicatif verifie d'abord pour
produire un message clair, mais c'est PostgreSQL qui tranche sous forte charge.

**Les QR sont chiffres, pas seulement signes.** `AES-256-GCM` authentifie le
contenu : un billet ne peut etre ni fabrique ni modifie sans la cle du serveur.
Changer `TICKET_QR_SECRET` invalide tous les billets deja emis.

**Airtel : la reference doit rester alphanumerique.** Un simple tiret provoque un
`DP00800001005` au moment de verifier le statut, et la meme valeur doit servir
pour `reference` et pour `transaction.id`. Le resultat se lit sur
`status.response_code`, jamais sur `transaction.status` de la reponse
d'initiation, qui vaut souvent `TS` avant meme la saisie du code PIN.

**MTN : la reference est un UUID.** `X-Reference-Id` doit etre un UUID v4, et
c'est lui qui sert ensuite a interroger le statut. Notre reference de commande
voyage dans `externalId`. Un `202 Accepted` signifie que la demande est partie,
pas que le paiement a eu lieu.

## Mise en production

1. Renseigner les identifiants Airtel (`AIRTEL_PRODUCTION="true"`) et MTN.
2. Declarer les URL de callback dans les consoles partenaires.
3. Regenerer `AUTH_SECRET` et `TICKET_QR_SECRET`.
4. `npx prisma migrate deploy` puis `npm run build && npm start`.

Prevoir une tache periodique qui appelle `releaseExpiredHolds()` et
`expireStaleBookings()` (`src/lib/seating.ts`, `src/lib/booking.ts`) pour liberer
les paniers abandonnes, meme si ces fonctions sont deja appelees a chaque
affichage de plan.

## Reste a faire

- Souscription d'abonnement en ligne : les formules sont affichees et le modele
  de donnees est pret, mais le tunnel d'achat pointe vers l'espace client.
- Utilisation des points de fidelite en reduction : les points sont cumules et
  affiches, pas encore depensables.
- Creation de compte client en autonomie (aujourd'hui, reservation en invite ou
  compte cree par un administrateur).
- Webhooks Airtel et MTN : les fonctions de lecture existent
  (`parseAirtelWebhook`, `parseMtnWebhook`), les routes HTTP restent a exposer.
  Le suivi par interrogation couvre deja le parcours client.
- Envoi du billet par email ou WhatsApp apres paiement.
