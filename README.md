# PDF Tools - Votre boîte à outils PDF complète

Application web de manipulation de PDF : remplissage de formulaires, conversion PDF/Image, signature avec horodatage.

## Stack technique

- **Frontend + Backend** : Next.js 14 (App Router) - déployé sur Vercel
- **Base de données** : PostgreSQL sur Neon
- **ORM** : Prisma
- **Traitement PDF** : pdf-lib (côté client)
- **Rendu PDF** : pdfjs-dist (côté client)
- **UI** : Tailwind CSS + Lucide Icons
- **Auth** : JWT avec jose + bcryptjs

## Fonctionnalités

- **Remplir PDF** : Détection automatique des champs AcroForm, ajout de texte libre
- **PDF → Image** : Conversion en JPG/PNG avec choix de qualité (72/150/300 DPI)
- **Image → PDF** : Fusion d'images avec options de mise en page (A4, Letter, etc.)
- **Signer PDF** : Signature manuscrite, horodatage automatique, sauvegarde des signatures

## Installation

### 1. Installer les dépendances

```powershell
cd "c:\Users\Max\Desktop\ilovpdf bis"
npm install
```

### 2. Configurer la base de données Neon

1. Créer un projet sur [neon.tech](https://neon.tech)
2. Copier l'URL de connexion
3. Créer le fichier `.env` à la racine :

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
JWT_SECRET="votre-secret-jwt-changez-le"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Initialiser la base de données

```powershell
npx prisma db push
```

### 4. Lancer en développement

```powershell
npm run dev
```

L'application sera accessible sur http://localhost:3000

## Déploiement sur Vercel

### 1. Initialiser Git et pousser sur GitHub

```powershell
cd "c:\Users\Max\Desktop\ilovpdf bis"
git init
git add .
git commit -m "Initial commit - PDF Tools app"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/pdf-tools.git
git push -u origin main
```

### 2. Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com)
2. Importer le repository GitHub
3. Ajouter les variables d'environnement :
   - `DATABASE_URL` : URL de connexion Neon
   - `JWT_SECRET` : Secret JWT pour la production
4. Déployer

## Structure du projet

```
├── app/
│   ├── api/
│   │   ├── auth/          # Routes d'authentification
│   │   └── signatures/    # CRUD signatures
│   ├── login/             # Page connexion/inscription
│   ├── pdf-fill/          # Remplir PDF
│   ├── pdf-to-image/      # Convertir PDF en images
│   ├── image-to-pdf/      # Convertir images en PDF
│   ├── sign-pdf/          # Signer PDF
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx           # Page d'accueil
├── components/
│   ├── file-upload.tsx    # Upload par drag & drop
│   ├── footer.tsx
│   ├── loading.tsx
│   ├── navbar.tsx
│   ├── signature-pad.tsx  # Pad de signature
│   └── tool-card.tsx
├── lib/
│   ├── auth.ts            # JWT helpers
│   └── db.ts              # Client Prisma
├── prisma/
│   └── schema.prisma      # Schéma BDD
└── package.json
```
