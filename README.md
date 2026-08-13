# Culture Parc, billetterie cinema

Plateforme de reservation en ligne pour les cinemas Culture Parc (Brazzaville,
Pointe-Noire, Ndjindji) : programme par ville, choix de la place sur un plan de
salle, paiement Airtel Money ou MTN Mobile Money, billet PDF avec QR code, et
controle d'acces a l'entree.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) et **React 19**
- **TypeScript** de bout en bout
- **PostgreSQL** via **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS 4** pour la charte
- **Auth.js v5** pour les comptes et les roles
- `pdf-lib` et `qrcode` pour les billets
- Application web installable (PWA) avec mode hors ligne

Aucun PHP, aucun Laravel : les integrations Airtel Money et MTN MoMo ont ete
reecrites en TypeScript.

## Demarrer

```bash
npm install
cp .env.example .env
```

Deux valeurs sont a generer :

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # TICKET_QR_SECRET (exactement 64 caracteres hex)
```

Lancez une base PostgreSQL, appliquez le schema, puis demarrez :

```bash
docker compose up -d
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

`npx prisma dev start cultureparc --detach` lance un PostgreSQL local. Recuperez
l'URL TCP avec `npx prisma dev ls` et mettez `DATABASE_POOL_MAX="1"` dans `.env` :
ce serveur de developpement ne supporte pas les connexions concurrentes. Pour
tout test de charge, utilisez Docker ou une base hebergee.

## Mode demonstration

`PAYMENT_SIMULATION="true"` fait jouer tout le tunnel de paiement en local, sans
appeler Airtel ni MTN. Un bandeau orange le signale sur la page de paiement. Le
dernier chiffre du numero payeur choisit le scenario :

| Fin du numero | Resultat |
| --- | --- |
| 0 | Solde insuffisant |
| 1 | Code PIN incorrect |
| 2 | Le client ne repond pas, la demande expire |
| autre | Paiement accepte apres environ 6 secondes |

Passez la variable a `"false"` le jour ou les identifiants operateurs sont
renseignes, sans quoi aucun encaissement reel n'a lieu.

## Deploiement sur Render

Le fichier `render.yaml` decrit le service web et la base. Depuis Render :
**New > Blueprint**, puis pointez ce depot. La base est creee et `DATABASE_URL`
injectee automatiquement.

Deux variables sont a saisir a la main dans le tableau de bord :

- `TICKET_QR_SECRET` : la changer invalide tous les billets deja emis.
- Les identifiants Airtel et MTN, quand ils sont disponibles.

Les migrations tournent **au demarrage**, pas au build. La base Render n'est
joignable que depuis le reseau prive, auquel la phase de build n'a pas acces :
`prisma migrate deploy` y echouerait sur un `P1001 Can't reach database server`.
Elles s'appliquent donc au lancement du service, ne font rien quand la base est
deja a jour, et Prisma pose un verrou pour que plusieurs instances demarrant
ensemble ne se marchent pas dessus.

Pour la meme raison, construire l'application n'exige aucune base : le client
Prisma n'est cree qu'au premier usage. La sonde `/api/sante`, elle, interroge
reellement la base, pour qu'un service coupe de sa base soit redemarre plutot
que de repondre a vide.

## Organisation

```
prisma/schema.prisma          Modele de donnees complet
prisma/seed.ts                Cinemas, salles, films, seances, tarifs de demo
src/lib/payments/             Airtel Money, MTN MoMo, et passerelle de demonstration
src/lib/pricing.ts            Resolution du prix d'une place
src/lib/seating.ts            Disponibilite et retenue temporaire des places
src/lib/seat-numbering.ts     Conventions de numerotation des salles
src/lib/booking.ts            Emission des billets apres paiement
src/lib/qr.ts                 Chiffrement et verification des QR codes
src/lib/scan.ts               Controle d'acces a l'entree
src/lib/ticket-pdf.ts         Billet imprimable
src/lib/city.ts               Ville active et filtrage du programme
src/lib/media.ts              Televersement des affiches et videos
src/lib/notifications.ts      Email et SMS aux clients
src/app/(pages publiques)     Accueil, films, programme, seance, commande
src/app/admin/                Back-office
src/app/scan/                 Poste de controle d'acces
scripts/                      Preparation du logo et des icones
```

## Points de conception

**Le 0 des numeros congolais.** Un numero s'ecrit +242 06 110 92 01 : l'indicatif
242 est suivi de neuf chiffres commencant par 0. Ce 0 ne se supprime jamais, y
compris au format international. Tout passe par `src/lib/phone.ts`.

**Montants entiers.** Le franc CFA n'a pas de sous-unite : aucun montant n'est
stocke en decimal, ce qui elimine les erreurs d'arrondi.

**Une ville a la fois.** Le programme de Brazzaville n'est pas celui de
Pointe-Noire. Le visiteur choisit sa ville une fois, et l'accueil, le catalogue,
le programme, les fiches films et les contacts du pied de page s'y limitent. La
liste des villes se deduit des sites actifs : un site cree depuis le back-office
apparait aussitot dans le selecteur.

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

**La numerotation des salles se plie a l'existant.** Une salle deja exploitee a
son ordre etabli, que le public connait. L'editeur permet donc de choisir le sens
de comptage, le numero de depart, le style des rangees et leur sens, et de forcer
le libelle d'une rangee. Imposer une convention obligerait a recoller des
etiquettes sur les fauteuils.

**Les medias vivent en base.** Render monte un disque ephemere, remis a zero a
chaque deploiement : une affiche televersee sur ce disque disparaitrait a la mise
en ligne suivante. Les fichiers sont donc stockes dans PostgreSQL et servis par
`/api/medias/[id]`, avec un cache immuable. Les URL externes restent possibles.

**Aucune notification ne se perd.** Sans fournisseur email ou SMS configure, les
messages d'annulation sont journalises avec le statut `SKIPPED` et leur contenu
complet, pour qu'un responsable reprenne la liste et appelle les clients. Une
annulation ne doit pas se perdre parce qu'une cle d'API manque.

**Airtel : la reference doit rester alphanumerique.** Un simple tiret provoque un
`DP00800001005` au moment de verifier le statut, et la meme valeur doit servir
pour `reference` et pour `transaction.id`. Le resultat se lit sur
`status.response_code`, jamais sur `transaction.status` de la reponse
d'initiation, qui vaut souvent `TS` avant meme la saisie du code PIN.

**MTN : la reference est un UUID.** `X-Reference-Id` doit etre un UUID v4, et
c'est lui qui sert ensuite a interroger le statut. Notre reference de commande
voyage dans `externalId`. Un `202 Accepted` signifie que la demande est partie,
pas que le paiement a eu lieu.

## Donnees de demonstration

Le catalogue reprend cinq films reels, avec leurs affiches et bandes-annonces
officielles servies par TMDB et YouTube. Les visuels sont references par URL, ils
ne sont pas copies dans le depot.

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
- Modification des medias d'un film deja cree : le televersement n'est pour
  l'instant propose qu'a la creation.
