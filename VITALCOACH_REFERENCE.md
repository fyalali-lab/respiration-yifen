# VITALCOACH — Fichier Central de Référence

> **Dernière mise à jour :** 8 mars 2026
> **Version :** 1.0.0-beta
> **Auteur :** Farid
> **Rôle Claude :** Chef de projet IT / UX / Développement

---

## 1. VISION PRODUIT

**Pitch :** VitalCoach est une application web de coaching biofeedback qui se connecte à une ceinture Polar H10 via Bluetooth, réalise un bilan physiologique du client avant séance, propose des exercices de respiration visuels guidés adaptés au profil du client, puis mesure l'impact post-séance. L'outil intègre un historique client complet et des disclaimers médicaux.

**Positionnement :** Outil professionnel de coaching bien-être et gestion du stress, combinable avec un accompagnement nutritionnel (lien futur avec Yifen). Pas un dispositif médical.

**Cible utilisateurs :**
- Utilisateur principal : Le coach (Farid), qui utilise l'app sur laptop/tablette en séance
- Utilisateur final : Le client, qui porte la ceinture H10 et suit les exercices visuels

**Contexte d'utilisation :** Cabinet fixe (laptop/écran) ET domicile client (laptop portable)

---

## 2. STACK TECHNIQUE

| Composant | Technologie | Raison |
|-----------|-------------|--------|
| Frontend | React (JSX) via Vite | Farid maîtrise déjà (Yifen) |
| Déploiement | Vercel | HTTPS obligatoire pour Web Bluetooth |
| Connexion capteur | Web Bluetooth API (0x180D / 0x2A37) | Standard BLE, pas de SDK propriétaire |
| Backend (futur V2) | Supabase | Cohérent avec Yifen |
| Capteur recommandé | Polar H10 | Gold standard validé scientifiquement |
| Navigateurs supportés | Chrome, Edge | Seuls à supporter Web Bluetooth |
| Non supportés | Safari, Firefox | Pas de Web Bluetooth |

**Décision architecturale clé :** L'app utilise le profil BLE Heart Rate standard (0x180D), PAS le SDK Polar propriétaire. Cela signifie que n'importe quelle ceinture ECG BLE compatible fonctionne (Garmin HRM-Pro, Wahoo TICKR, Movesense). Neutralité hardware = pas de lock-in.

---

## 3. FEATURES V1 — ÉTAT ACTUEL

### 3.1 Profil client ✅ INTÉGRÉ
- Champs : Prénom/Nom, Sexe (M/F), Âge (slider 16-85), Poids (40-160 kg), Taille (140-210 cm), IMC auto-calculé
- Niveau activité : Sédentaire / Modéré / Actif
- Fumeur (checkbox), Médicaments (texte libre — bêtabloquants flaggés)
- Objectifs multiples : Gestion du stress, Perte de poids, Sommeil, Performance
- **Contexte clinique** (nouveau) : COVID long, Anxiété/TAG, Burn-out, Trauma/PTSD, Troubles du sommeil, Douleurs chroniques, Dépression. Sélection multiple. Déclaratif. Conditionne le protocole respiratoire recommandé (profils vulnérables → protocole doux 3-5)
- Normes HRV calibrées par âge et sexe (tables Nunan 2010, Shaffer 2017)
- Les normes couvrent 6 tranches d'âge (20-29, 30-39, 40-49, 50-59, 60-69, 70+) × 2 sexes

### 3.2 Consentement RGPD ✅ INTÉGRÉ
- Formulaire obligatoire à la création du profil client
- Texte couvre : traitement données physiologiques, disclaimer non-médical, droits RGPD
- Checkbox "J'ai lu et j'accepte" obligatoire pour continuer
- Consentement stocké avec le profil

### 3.3 Questionnaire pré-séance ✅ INTÉGRÉ
- 4 dimensions mesurées sur échelle emoji 5 niveaux (😫😟😐🙂😊) :
  - État général / bien-être
  - Niveau de stress perçu
  - Qualité du sommeil (nuit précédente)
  - Niveau d'énergie
- Champ texte optionnel "Remarque" (événement particulier, contexte)

### 3.4 Questionnaire post-séance ✅ INTÉGRÉ
- 2 dimensions reprises du pré (bien-être, stress) pour mesurer le delta
- Difficulté de l'exercice : Facile / Confortable / Difficile / Trop dur
- Changement ressenti : Oui nettement / Un peu / Pas vraiment / Moins bien
- Le bilan final croise le delta subjectif (questionnaires) et objectif (HRV)

### 3.5 Connexion Polar H10 + Mesure avant/après ✅ INTÉGRÉ
- Connexion via Web Bluetooth (navigator.bluetooth.requestDevice)
- Filtre sur service heart_rate (0x180D)
- Parsing complet caractéristique 0x2A37 :
  - Flags byte (format 8/16 bits, RR present, Energy Expended)
  - Heart Rate (uint8 ou uint16)
  - RR intervals convertis de 1/1024s en millisecondes
- Niveau de batterie lu via battery_service (optionnel)
- Gestion déconnexion automatique (gattserverdisconnected)

### 3.6 Moteur HRV (7 métriques) ✅ INTÉGRÉ
| Métrique | Domaine | Calcul | Interprétation |
|----------|---------|--------|----------------|
| RMSSD | Temporel | √(Σ(RRi+1 - RRi)² / (N-1)) | Activité parasympathique. Plus haut = meilleure récupération |
| SDNN | Temporel | Écart-type des RR | Variabilité globale. Plus haut = meilleure adaptabilité |
| pNN50 | Temporel | % de RR successifs différant > 50ms | Tonus vagal |
| FC moyenne | — | 60000 / mean(RR) | Fréquence cardiaque de repos |
| Stress Index | Temporel | Indice de Baevsky (AMo / 2×Mo×MxDMn) | Charge sympathique. Plus bas = plus détendu |
| LF/HF | Fréquentiel | Ratio puissance 0.04-0.15 Hz / 0.15-0.4 Hz | Équilibre SNA. > 2.5 = dominance sympathique |
| Cohérence | Fréquentiel | Peak power / total power × 300 (0-100%) | Synchronisation cardio-respiratoire |

**Filtre d'artefacts :**
- Rejet physiologique : RR < 300ms ou > 2000ms
- Rejet contextuel : RR déviant > 25% de la moyenne locale (RR-1, RR+1)
- Taux d'artefacts calculé et intégré au score de fiabilité

**Score de fiabilité :**
- Taux d'artefacts (pénalité ×0.5)
- Adéquation échantillons vs durée (pénalité ×0.3)
- Bonus durée : < 1min = -15pts, < 2min = -10pts
- Résultat 0-100% affiché avec badge FIABLE / ACCEPTABLE / FAIBLE

### 3.7 Recommandation de protocole respiratoire ✅ INTÉGRÉ
Arbre de décision à 4 niveaux basé sur les métriques pré-séance :

| Niveau | Condition | Protocole | Confiance | Durée |
|--------|-----------|-----------|-----------|-------|
| 0 — Profil vulnérable + HRV bas | Contexte clinique (COVID long, anxiété, burn-out, trauma) + RMSSD < 20 OU FC > 85 | Respiration douce 3-5 | 90% | 4 min |
| 1 — Stress aigu | RMSSD < 18 OU Stress Index > 200 OU FC > 90 + RMSSD < 25 | 4-7-8 (ou 4-6 si vulnérable) | 92% | 5 min |
| 2 — Stress modéré | RMSSD 18-25 + FC > 75 OU LF/HF 2.5-4 | Cohérence 4-6 | 87% | 5 min |
| 3 — HRV correct, cohérence basse | RMSSD ≥ 25 + cohérence < 35% | Résonance 5.5/min | 84% | 7 min |
| 4 — Bon état | Défaut | Cohérence 5-5 | 80% | 5 min |

Chaque recommandation inclut : raisons factuelles, explication du mécanisme, durée optimale justifiée.
Le coach peut overrider via un menu dépliable (bandeau "override actif" affiché).

### 3.8 Exercices de respiration visuels ✅ INTÉGRÉ
- 5 protocoles disponibles :
  - Respiration douce 3-5 (inspire 3s, expire 5s — profils vulnérables)
  - Cohérence 5-5 (inspire 5s, expire 5s)
  - Cohérence 4-6 (inspire 4s, expire 6s — parasympathique +)
  - Respiration 4-7-8 (inspire 4s, rétention 7s, expire 8s)
  - Résonance 5.5/min (inspire 5.45s, expire 5.45s)
  - Résonance personnalisée (fréquence individuelle après recherche)
- **6 thèmes visuels Canvas animés** (biofeedback gamifié) :
  - 🌊 **Océan** : vagues ondulantes, orbe aquatique, particules d'écume. La cohérence influence la taille des vagues et la luminosité
  - 🌌 **Aurore** : ciel étoilé, bandes d'aurores boréales, pilier de lumière. La cohérence fait shifter les couleurs (violet→vert→cyan) et illumine les bandes
  - ◈ **Géométrie** : mandala sacré avec polygones rotatifs imbriqués. La cohérence ajoute des couches de complexité et des orbites de points lumineux
  - 🌳 **Forêt** : arbre central avec tronc, canopée multicouche qui oscille, sève qui monte à l'inspiration. La cohérence fait fleurir l'arbre et allume des lucioles
  - ✦ **Cosmos** : espace profond, nébulosités, galaxie spirale qui se construit avec la cohérence, zoom stellaire à l'inspiration. Plus la cohérence monte, plus la galaxie est structurée
  - ○ **Minimal** : superellipse morphante (cercle→carré arrondi selon le cycle), traces fantômes des cycles précédents, dots orbitaux, pulse ring. Esthétique épurée, la cohérence enrichit la luminosité et ajoute des traces
- Le sélecteur de thème est dans la config pré-exercice ET changeable en temps réel pendant l'exercice
- La cohérence influence le visuel en temps réel → gamification intrinsèque (le client veut "faire briller" le visuel)
- Anneau de cohérence SVG autour du canvas (commun à tous les thèmes)
- Timer avec compte à rebours et compteur de cycles
- BPM en direct pendant l'exercice
- Durée réglable par slider (1 min à 10 min, pas de 30s)

### 3.9 Guide audio ✅ INTÉGRÉ
- Oscillateur sinusoïdal (Web Audio API) :
  - Ton montant (220 Hz → 440 Hz) à l'inspiration
  - Ton descendant (440 Hz → 220 Hz) à l'expiration
  - Volume réduit pendant les phases de rétention
- Fond sonore : bruit rose (pink noise) généré procéduralement
- Volume contrôlé (discret, ambiance)
- Activable / désactivable par checkbox

### 3.10 Biofeedback temps réel ✅ INTÉGRÉ
- Jauge de cohérence cardiaque en direct (barre horizontale 0-100%)
- Code couleur dynamique : rouge (< 30%) → jaune (30-60%) → vert (> 60%)
- Anneau SVG autour de l'orbe respiratoire proportionnel à la cohérence
- Calculé sur les 60 derniers RR intervals en rolling window
- Transition fluide (0.5s ease)

### 3.11 Timer intelligent de séance ✅ INTÉGRÉ
Flow séquencé automatique :
1. Questionnaire pré-séance
2. Mesure pré-séance (enregistrement RR)
3. Résultats pré + recommandation protocole
4. Exercice de respiration (animation + audio + biofeedback)
5. Mesure post-séance
6. Questionnaire post-séance
7. Notes du coach
8. Bilan final avec comparaison

Chaque transition est gérée par la state machine `sessionPhase`.

### 3.12 Tableau de bord évolution client ✅ INTÉGRÉ
- Liste des séances par client (tri chronologique inversé)
- Graphique en barres de l'évolution du RMSSD pré-séance
- Détail par séance : date, programme, RMSSD avant→après (%), bien-être avant→après
- **Moteur d'évolution longitudinale (EvolutionEngine)** :
  - Score de progression 0-100 (widget circulaire) basé sur tendance RMSSD, stabilité, nombre de séances
  - Détection automatique de **plateau** (RMSSD stagne sur 3+ séances, variance < 10%)
  - Détection automatique de **régression** (chute > 25% vs moyenne des 3 séances précédentes)
  - Suggestions de **progression de protocole** : soft35 → coherence46 → resonance (basé sur seuils RMSSD stables)
  - Suggestions d'**adaptation de durée** : allonger si exercices rapportés "faciles", raccourcir si "difficiles"
  - Suggestion de **changement de programme** : Sérénité → Équilibre après 5+ séances avec bonne progression
  - Insights avec icônes (📈📉⚡) et actions suggérées concrètes
- Accessible depuis la fiche client ou le bilan de séance

### 3.13 Notes du coach ✅ INTÉGRÉ
- Textarea libre après chaque séance
- Stocké dans l'objet session avec toutes les autres données
- Affiché dans le bilan final et l'historique

### 3.14 Gestion multi-programmes ✅ INTÉGRÉ
| Programme | Durée | Phases | Cible |
|-----------|-------|--------|-------|
| 🌙 Sérénité | 40 min | Pré 5' + Exercice 20' + Post 5' + Debrief 10' | Stress pur |
| ⚖️ Équilibre | 1h | Pré 5' + Exercice 25' + Post 5' + Debrief 25' | Stress + nutrition |
| 🔥 Transformation | 1h30 | Pré 5' + Exercice 30' + Post 5' + Debrief 50' | Programme complet |

Sélection visuelle avec icône et description. Le programme conditionne le timing de séance.

### 3.15 Mode démo ✅ INTÉGRÉ
- Client fictif pré-rempli (35 ans, Homme, IMC 24.5)
- Données RR simulées (random walk physiologiquement réaliste)
- Permet de tester le flow complet sans ceinture Polar H10
- Badge "DÉMO" visible en header
- Données post-séance simulées avec RMSSD légèrement meilleur

### 3.16 Aide à la décision post-séance ✅ INTÉGRÉ
- Croisement delta HRV objectif + ressenti subjectif client
- 3 niveaux :
  - ✅ Réponse positive (RMSSD +15%) : poursuivre avec progression
  - ⚡ Amélioration modérée (RMSSD +5-15%) : ajuster protocole/durée
  - 📋 Réponse limitée (< +5%) : envisager autre approche + orientation santé
- Disclaimer médical permanent en bas

---

## 4. FEATURES PLANIFIÉES — ROADMAP

### V1.1 (prochaine itération)
- [x] **Recherche de fréquence de résonance** — Protocole 5 paliers (4.5 à 6.5 resp/min, pas de 0.5). Mesure RMSSD à chaque palier (2 min/palier). L'app identifie le palier où RMSSD est max → fréquence de résonance personnalisée stockée dans le profil client. ✅ INTÉGRÉ V1
- [x] **Export rapport de séance** — Génération fichier texte structuré avec toutes les données : profil, métriques avant/après, questionnaires, aide à la décision, notes coach, disclaimer. Téléchargement automatique. ✅ INTÉGRÉ V1
- [ ] **Persistance Supabase** — Clients + sessions stockés en base. Auth coach. Fin du stockage in-memory

### V2.0
- [x] **3 thèmes visuels supplémentaires** — Forêt (arbre vivant avec sève, canopée, lucioles, fleurs de cohérence), Cosmos (nébuleuse, galaxie spirale, étoiles, zoom breathing), Minimaliste (superellipse morphante, traces fantômes, dots orbitaux). ✅ INTÉGRÉ V1
- [ ] **Intégration Yifen** — Onglet nutrition dans le profil client. Synchronisation plan alimentaire + données stress
- [ ] **Rappel inter-séance** — Email/message personnalisé avec recommandations de pratique autonome
- [ ] **Objectifs et jalons** — Le client fixe un objectif, l'app track la progression avec jalons visuels
- [ ] **Export données pour professionnel de santé** — Format structuré partageable

### V3.0
- [ ] **Mode multi-coach** — VitalCoach en SaaS avec abonnement mensuel (29-49€/coach)
- [ ] **Onboarding coach** — Tuto interactif première utilisation
- [ ] **Tableau de bord analytics coach** — Vue d'ensemble de tous les clients, alertes

---

## 5. DÉCISIONS PRISES (NE PAS REVENIR DESSUS)

| Décision | Raison | Date |
|----------|--------|------|
| Web app, pas mobile | Ceinture BLE + écran large = meilleure expérience coaching | 06/03/2026 |
| Standard BLE (0x180D), pas SDK Polar | Neutralité hardware, pas de lock-in | 06/03/2026 |
| React + Vite + Vercel | Stack connue par Farid, HTTPS natif | 06/03/2026 |
| Supabase pour la persistance (V2) | Cohérent avec Yifen, déjà maîtrisé | 06/03/2026 |
| Normes HRV par âge/sexe obligatoires | Un même RMSSD n'a pas la même signification selon le profil | 06/03/2026 |
| 4 protocoles respiratoires + recommandation auto | Différenciation vs apps gratuites de cohérence cardiaque | 06/03/2026 |
| Override coach toujours possible | L'app recommande, le coach décide | 06/03/2026 |
| Disclaimer médical sur chaque écran de diagnostic | Protection juridique, micro-entreprise | 06/03/2026 |
| Audio optionnel (pas par défaut imposé) | Certains clients préfèrent le silence | 06/03/2026 |
| Filtre artefacts à 25% seuil local | Bon compromis sensibilité/spécificité pour le H10 | 06/03/2026 |
| Protocole doux 3-5 pour profils vulnérables | COVID long, anxiété sévère → tolérance réduite à l'effort respiratoire | 06/03/2026 |
| Contexte clinique déclaratif, pas diagnostique | Le coach n'est pas médecin. L'info sert uniquement à adapter le protocole | 06/03/2026 |

---

## 6. MODÈLE COMMERCIAL

### Pricing séances (à valider par test marché)
| Formule | Durée | Prix indicatif |
|---------|-------|----------------|
| Sérénité | 40 min | ~60€ |
| Équilibre | 1h | ~90€ |
| Transformation | 1h30 | ~120€ |
| Pack 10 séances | Variable | ~1 000€ |

### Coûts matériels
- Polar H10 : ~90€ prix public, ~63€ en tarif B2B estimé (30% remise)
- 2-3 ceintures tailles variées (XS-S, M-XXL) : ~180-270€ investissement initial
- Sangles de rechange : ~25€

### Plan 5 coups
1. **Validation produit** — Tester sur soi + 2-3 proches. Coût : 0€
2. **Premières séances payantes** — 2 H10 supplémentaires, prêt en séance. Invest : ~180€
3. **Kit client** — Contact Polar France B2B. Ceinture incluse dans offre packagée
4. **Structuration B2B** — Formation d'autres coaches. Distribution ceintures via Farid
5. **Plateforme SaaS** — VitalCoach en abonnement mensuel pour coaches indépendants

### Structure juridique
- Phase 1-3 : Micro-entreprise
- Phase 4+ : À évaluer (SASU si dépassement seuils)

---

## 7. PROTOCOLES RESPIRATOIRES — SPECS

| ID | Nom | Inspire | Rétention | Expire | Pause | Cycle | Usage |
|----|-----|---------|-----------|--------|-------|-------|-------|
| soft35 | Respiration douce 3-5 | 3s | 0 | 5s | 0 | 8s | Profils vulnérables (COVID long, anxiété sévère, première séance) |
| coherence55 | Cohérence 5-5 | 5s | 0 | 5s | 0 | 10s | Maintien, équilibre SNA |
| coherence46 | Cohérence 4-6 | 4s | 0 | 6s | 0 | 10s | Activation parasympathique douce |
| box478 | Respiration 4-7-8 | 4s | 7s | 8s | 0 | 19s | Stress aigu, relaxation profonde |
| resonance | Résonance 5.5/min | 5.45s | 0 | 5.45s | 0 | 10.9s | Optimisation baroréflexe |
| resonanceCustom | Résonance perso | Variable | 0 | Variable | 0 | Variable | Fréquence de résonance individuelle |

---

## 8. NORMES HRV DE RÉFÉRENCE

### RMSSD par profil (ms) — [bas, moyen, bon]

| Tranche | Homme | Femme |
|---------|-------|-------|
| 20-29 | 24 / 43 / 72 | 22 / 39 / 66 |
| 30-39 | 19 / 35 / 60 | 17 / 32 / 55 |
| 40-49 | 15 / 28 / 48 | 14 / 25 / 44 |
| 50-59 | 12 / 22 / 38 | 11 / 20 / 35 |
| 60-69 | 10 / 18 / 30 | 9 / 16 / 28 |
| 70+ | 8 / 15 / 25 | 7 / 13 / 23 |

Sources : Nunan et al. 2010, Shaffer & Ginsberg 2017

---

## 9. STRUCTURE DU CODE

```
VitalCoachV1.jsx (fichier unique)
├── Design Tokens (T) — couleurs, fonts, spacing
├── HRV_NORMS — tables de normes par âge/sexe
├── HRV Engine — calculs métriques + recommandation + diagnostic
├── AudioEngine — Web Audio API (oscillateur + pink noise)
├── PROTOCOLS — définition des protocoles respiratoires
├── PROGRAMS — définition des programmes de séance
├── Components réutilisables
│   ├── Btn — bouton avec variantes
│   ├── Card — conteneur avec style
│   ├── Metric — affichage métrique avec sévérité
│   ├── SliderInput — slider avec label/format
│   ├── EmojiScale — échelle 5 niveaux emoji
│   ├── ReliabilityBadge — badge fiabilité
│   ├── BreathingOrb — animation respiratoire + anneau cohérence
│   ├── RRChart — graphique RR intervals (canvas)
│   └── CoherenceGauge — jauge horizontale cohérence
└── VitalCoach (composant principal)
    ├── State management (useState)
    ├── BLE connection + parsing
    ├── Session flow (state machine sessionPhase)
    ├── Breathing engine (requestAnimationFrame)
    └── Views: home, newClient, preQ, preMeasure, preResults,
              exercise, postMeasure, postQ, notes, results, dashboard
```

---

## 10. DONNÉES STOCKÉES PAR SESSION

```json
{
  "id": "timestamp",
  "clientId": "string",
  "date": "ISO 8601",
  "program": "serenite | equilibre | transformation",
  "preMetrics": { "rmssd", "sdnn", "pnn50", "meanHR", "stressIndex", "lfhf", "coherence" },
  "postMetrics": { "idem" },
  "preReliability": "number 0-100",
  "postReliability": "number 0-100",
  "preQ": { "wellbeing": 1-5, "stress": 1-5, "sleep": 1-5, "energy": 1-5, "note": "string" },
  "postQ": { "wellbeing": 1-5, "stress": 1-5, "difficulty": 1-4, "feltChange": 1-4, "note": "string" },
  "notes": "string (coach)",
  "protocol": "coherence55 | coherence46 | box478 | resonance",
  "breathDuration": "number (secondes)"
}
```

---

## 11. CONTRAINTES ET LIMITES CONNUES

- **Web Bluetooth = Chrome/Edge only** — Safari et Firefox non supportés
- **HTTPS obligatoire** — Web Bluetooth refuse de fonctionner en HTTP
- **Pas d'accès accéléromètre H10** — Le BLE standard ne l'expose pas (SDK Polar natif seulement)
- **Pas d'ECG brut** — Le profil BLE Heart Rate ne transmet que HR + RR, pas le tracé ECG. L'ECG nécessite le Polar SDK (apps natives uniquement)
- **LF/HF simplifié** — L'analyse spectrale par DFT est une approximation. Pour un LF/HF clinique-grade, il faudrait Lomb-Scargle avec interpolation
- **Stockage in-memory V1** — Tout est perdu au refresh. Supabase résoudra ça en V1.1/V2
- **Single coach** — Pas de multi-utilisateur en V1

---

## 12. INSTRUCTIONS POUR CLAUDE

À chaque nouvelle session de travail sur VitalCoach :
1. Lire ce fichier en premier
2. Vérifier l'état des features (section 3) avant de coder
3. Ne jamais supprimer une feature existante sans décision explicite
4. Mettre à jour ce fichier après chaque modification significative
5. Respecter les décisions de la section 5
6. Utiliser les Design Tokens (section 9) pour tout nouveau composant
7. Garder le fichier JSX unique tant que la complexité le permet
8. Toujours inclure le disclaimer médical sur les écrans de diagnostic

---

*Ce document est la source de vérité pour VitalCoach. Toute modification du produit doit être reflétée ici.*
