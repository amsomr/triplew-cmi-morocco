# 🇲🇦 triplew-cmi-morocco

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Maintained by TripleW Digital](https://img.shields.io/badge/Maintained%20by-TripleW%20Digital-0284c7)](https://triplew.ma)

> SDK & Passerelle TypeScript / Node.js moderne et sécurisée pour l'intégration du **CMI (Centre Monétique Interbancaire)** au Maroc avec support natif du hachage **SHA-512** et **3D Secure 2.0**.
> 
> Développé et maintenu par **[TripleW Digital - Agence Web & SEO au Maroc](https://triplew.ma/)**.
> 📖 Consultez le tutoriel complet et l'architecture recommandée sur notre guide : **[Guide d'intégration CMI Maroc sur Next.js & Node.js](https://triplew.ma/blog/integration-paiement-cmi-maroc)**.

---

## ⚡ Pourquoi ce package ?

L'intégration de la passerelle CMI au Maroc présente souvent des difficultés techniques pour les développeurs modernes :
- Signature cryptographique stricte (tri insensible à la casse, échappement obligatoire des caractères spéciaux `\` et `|`, encodage SHA-512 en Base64).
- Gestion des callbacks IPN (Instant Payment Notification) serveur à serveur et des redirections navigateur.
- Prise en charge des environnements modernes (Next.js App Router, Remix, Nuxt, Express, Fastify, NestJS).

Ce module open-source standardise le protocole CMI et garantit une compatibilité à 100% avec les spécifications officielles de la plateforme CMI Maroc.

---

## 📦 Installation

```bash
npm install triplew-cmi-morocco
# ou
pnpm add triplew-cmi-morocco
# ou
yarn add triplew-cmi-morocco
```

---

## 🚀 Utilisation rapide

### 1. Initialiser le client CMI

```typescript
import { CMIGateway } from 'triplew-cmi-morocco';

const cmi = new CMIGateway({
  clientId: process.env.CMI_CLIENT_ID!, // ex: '600001234'
  storeKey: process.env.CMI_STORE_KEY!, // Fourni par le CMI lors du contrat VAD
  isProduction: process.env.NODE_ENV === 'production',
  okUrl: 'https://votre-boutique.ma/checkout/success',
  failUrl: 'https://votre-boutique.ma/checkout/failed',
  callbackUrl: 'https://votre-boutique.ma/api/cmi/ipn', // Callback serveur à serveur
  shopUrl: 'https://votre-boutique.ma/boutique',
  currency: '504', // Code ISO 4217 pour le Dirham Marocain (MAD)
  lang: 'fr'
});
```

---

### 2. Exemple avec Next.js App Router (`app/api/checkout/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { CMIGateway } from 'triplew-cmi-morocco';

const cmi = new CMIGateway({
  clientId: process.env.CMI_CLIENT_ID!,
  storeKey: process.env.CMI_STORE_KEY!,
  isProduction: process.env.NODE_ENV === 'production',
  okUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/commande/succes`,
  failUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/commande/echec`,
  callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/cmi/ipn`
});

export async function POST(req: NextRequest) {
  const { commandeId, montant, client } = await req.json();

  // Génération des paramètres signés avec le HASH SHA-512
  const params = cmi.createPaymentParams({
    orderId: commandeId,
    amount: montant,
    email: client.email,
    billToName: client.nomComplet,
    tel: client.telephone
  });

  // Génération du formulaire HTML auto-soumis pour rediriger le client vers CMI
  const html = cmi.createAutoSubmitHtml(params);

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
```

---

### 3. Gestion du callback de validation IPN (`app/api/cmi/ipn/route.ts`)

Lors de la finalisation du paiement, le CMI envoie une notification POST sécurisée à votre `callbackUrl` :

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { CMIGateway } from 'triplew-cmi-morocco';

const cmi = new CMIGateway({
  clientId: process.env.CMI_CLIENT_ID!,
  storeKey: process.env.CMI_STORE_KEY!,
  okUrl: '',
  failUrl: ''
});

export async function POST(req: NextRequest) {
  // Lecture des données form-urlencoded envoyées par le CMI
  const formData = await req.formData();
  const body: Record<string, string> = {};
  formData.forEach((value, key) => {
    body[key] = value.toString();
  });

  // Validation cryptographique de l'authenticité et du statut
  const result = cmi.handleCallback(body);

  if (!result.isValid) {
    console.error('[CMI IPN] Signature HASH invalide. Tentative de falsification potentielle.');
    return new NextResponse('FAILURE', { status: 400 });
  }

  if (result.isApproved) {
    const { orderId, amount, transactionId, authCode } = result;
    
    // TODO: Mettre à jour votre base de données (ex: Prisma, PostgreSQL)
    // await db.order.update({ where: { id: orderId }, data: { status: 'PAID', transactionId } });

    console.log(`[CMI IPN] Paiement validé pour la commande #${orderId} (Montant: ${amount} MAD)`);
    
    // CMI attend impérativement la réponse 'ACTION=POSTAUTH' pour acquitter la transaction
    return new NextResponse('ACTION=POSTAUTH', {
      headers: { 'Content-Type': 'text/plain' }
    });
  } else {
    console.warn(`[CMI IPN] Paiement refusé. Code: ${result.errorCode}, Erreur: ${result.errorMessage}`);
    return new NextResponse('APPROVED', { status: 200 });
  }
}
```

---

### 4. Utilisation directe des fonctions de hachage

Si vous souhaitez simplement calculer ou vérifier un hash CMI :

```typescript
import { generateCMIHash, verifyCMIResponseHash } from 'triplew-cmi-morocco';

const storeKey = 'VOTRE_CLE_SECRETE_CMI';

// 1. Calculer le hash
const payload = {
  clientid: '600001234',
  amount: '450.00',
  oid: 'CMD-2026-0042',
  okUrl: 'https://mon-site.ma/success',
  failUrl: 'https://mon-site.ma/fail',
  TranType: 'Auth',
  currency: '504',
  rnd: '1711283920192'
};

const hash = generateCMIHash(payload, storeKey);

// 2. Vérifier le hash reçu dans une réponse POST
const isValid = verifyCMIResponseHash(responseBody, storeKey);
```

---

## 🔒 Sécurité et Conformité Réglementaire

1. **Secret Key Isolation** : La `storeKey` ne doit jamais être exposée côté client (frontend). Toutes les signatures et validations doivent être exécutées sur votre serveur backend.
2. **Conformité CNDP (Loi 09-08)** : Les données bancaires des porteurs de cartes ne transitent jamais par votre serveur ; elles sont saisies directement sur l'environnement certifié PCI-DSS du CMI.
3. **Double vérification IPN** : Ne validez jamais une commande uniquement sur la redirection navigateur de l'utilisateur (`okUrl`). Validez l'état de la commande via le webhook serveur à serveur (`callbackUrl`) qui est invulnérable aux fermetures impromptues d'onglets.

---

## 🤝 Contribution & Support

Les contributions sont les bienvenues ! Vous pouvez ouvrir une issue ou proposer une pull request sur le dépôt officiel.

Besoin d'un accompagnement sur-mesure pour votre infrastructure e-commerce au Maroc ?
- 🌐 Site Web : **[TripleW Digital](https://triplew.ma/)**
- 📧 Contact : **[contact@triplew.ma](mailto:contact@triplew.ma)**
- 🏢 Services : Conception Web Next.js, Audit SEO Maroc, Intégrations E-commerce CMI & Fastlane.

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](./LICENSE) pour plus d'informations.
Copyright © 2026 [TripleW Digital](https://triplew.ma).
