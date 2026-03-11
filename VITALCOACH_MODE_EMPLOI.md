# VITALCOACH — MODE D'EMPLOI

> Guide pratique pour le coach • Version 1.0

---

## SOMMAIRE

1. Installation et premier lancement
2. Matériel nécessaire
3. Créer un profil client
4. Déroulement d'une séance type
5. Recherche de fréquence de résonance
6. Comprendre les métriques
7. Lire le diagnostic et la recommandation
8. Guide des exercices de respiration
9. Le rapport de séance
10. Suivi et historique client
11. Mode démo
12. Dépannage
13. Mentions légales et limites

---

## 1. INSTALLATION ET PREMIER LANCEMENT

### Prérequis
- Un ordinateur avec Bluetooth (laptop ou tablette)
- Le navigateur **Google Chrome** ou **Microsoft Edge** (obligatoire — Safari et Firefox ne supportent pas la connexion Bluetooth)
- Une connexion internet (pour le premier chargement)

### Déploiement
1. Créer un projet Vite + React :
   ```
   npm create vite@latest vitalcoach -- --template react
   cd vitalcoach
   npm install
   ```
2. Remplacer le contenu de `src/App.jsx` par le fichier `VitalCoachV1.jsx`
3. Lancer en local : `npm run dev` → Ouvrir dans Chrome
4. Pour déployer sur Vercel : connecter le repo GitHub et déployer. L'URL sera en HTTPS, ce qui est obligatoire pour le Bluetooth

### Premier test
- Utiliser le **Mode démo** (bouton "Démo" sur l'écran d'accueil) pour tester le flow complet sans ceinture

---

## 2. MATÉRIEL NÉCESSAIRE

### Ceinture Polar H10
- **Achat** : ~90€ sur Amazon, Decathlon, ou le site Polar
- **Tailles** : XS-S (tour de poitrine 52-66 cm) ou M-XXL (65-93 cm)
- **Recommandation** : avoir 2 ceintures (une de chaque taille) pour couvrir toutes les morphologies clients

### Préparation avant chaque séance
1. **Humidifier les électrodes** de la ceinture (les 2 zones rugueuses à l'intérieur) avec un peu d'eau ou un spray
2. **Positionner** la ceinture sous les pectoraux du client, le capteur au centre, logo vers le haut
3. **Serrer** suffisamment pour qu'elle ne glisse pas, mais sans gêner la respiration
4. **Attendre 10-15 secondes** que le signal se stabilise avant de lancer la mesure

### Hygiène
- Nettoyer la ceinture textile à l'eau claire après chaque client
- Ne pas utiliser de savon agressif sur les électrodes
- Laisser sécher à l'air libre
- Remplacer la sangle textile tous les 1-2 ans

---

## 3. CRÉER UN PROFIL CLIENT

### Accès
Écran d'accueil → **"Nouveau client"**

### Informations à renseigner

**Données obligatoires :**
- **Prénom Nom** — Identifiant du client
- **Sexe biologique** (Homme / Femme) — Utilisé pour calibrer les normes HRV
- **Âge** — Les normes HRV varient fortement selon l'âge
- **Poids et taille** — Calcul automatique de l'IMC
- **Niveau d'activité** — Sédentaire / Modéré / Actif

**Données optionnelles mais recommandées :**
- **Fumeur** — Impact direct sur le système vasculaire et le HRV
- **Médicaments** — Surtout les bêtabloquants qui faussent les mesures (FC artificiellement basse). Si le client prend des bêtabloquants, le noter ici : les métriques seront moins fiables
- **Objectifs** — Gestion du stress, Perte de poids, Sommeil, Performance. Sélection multiple possible

**Contexte clinique (nouveau) :**
- COVID long, Anxiété/TAG, Burn-out, Trauma/PTSD, Troubles du sommeil, Douleurs chroniques, Dépression
- Ce champ permet à l'app d'adapter le protocole respiratoire. Par exemple, un client COVID long avec HRV bas recevra un protocole d'entrée plus doux (3-5) au lieu du 4-7-8 qui pourrait être trop exigeant
- Ces informations sont **déclaratives** — vous ne posez pas de diagnostic

**Consentement RGPD :**
- Le client doit lire et cocher le consentement avant de pouvoir continuer
- Couvre : traitement des données physiologiques, disclaimer non-médical, droits d'accès/rectification/suppression

---

## 4. DÉROULEMENT D'UNE SÉANCE TYPE

### Avant la séance (5 min)
1. Ouvrir VitalCoach dans Chrome
2. Sélectionner le client (ou en créer un nouveau)
3. Connecter la ceinture Polar H10 : bouton **"Connecter Polar H10"** → sélectionner l'appareil dans la popup Chrome
4. Vérifier que le statut passe au vert "Connecté" et que le BPM en direct s'affiche
5. Choisir le programme : **Sérénité** (40 min), **Équilibre** (1h) ou **Transformation** (1h30)
6. Cliquer **"Démarrer la séance"**

### Phase 1 — Questionnaire d'arrivée (1-2 min)
- Le client évalue son état sur 4 dimensions avec les emojis : bien-être, stress, sommeil, énergie
- Champ texte optionnel pour noter un événement particulier
- Cliquer **"Lancer la mesure pré-séance"**

### Phase 2 — Mesure pré-séance (3-5 min)
- L'app enregistre les battements cardiaques en temps réel
- Vous voyez en direct : la FC, le nombre de RR reçus, le RMSSD en cours de calcul, et le graphique des intervalles RR
- **Minimum recommandé : 3 minutes.** Idéal : 5 minutes. Un timer vous indique le temps restant avant le minimum
- Le client doit rester **calme, assis, respiration naturelle** — pas de conversation pendant la mesure
- Cliquer **"Arrêter la mesure"** quand vous êtes satisfait de la durée

### Phase 3 — Résultats pré-séance + Recommandation (2-3 min)
- L'app affiche les 7 métriques avec code couleur (vert/jaune/rouge)
- Le **badge de fiabilité** indique la qualité de la mesure (Fiable / Acceptable / Faible)
- Le **diagnostic contextuel** analyse l'état du client en tenant compte de son profil (âge, sexe, contexte clinique)
- L'app **recommande automatiquement un protocole respiratoire** avec :
  - Le nom du protocole et sa description
  - Le score de confiance
  - Les raisons factuelles (quelles métriques ont guidé le choix)
  - L'explication du mécanisme d'action (à partager avec le client)
  - La durée optimale

**En tant que coach, vous pouvez :**
- Accepter la recommandation (cliquer sur la carte bleue)
- Overrider en dépliant "Choisir un autre protocole" et en sélectionnant un autre
- Ajuster la durée avec le slider
- Activer/désactiver le guide audio

Cliquer **"Lancer l'exercice"**

### Phase 4 — Exercice de respiration (5-30 min selon programme)
- L'**orbe respiratoire** guide visuellement le client : il grossit à l'inspiration, rétrécit à l'expiration
- L'**anneau de cohérence** autour de l'orbe change de couleur en temps réel :
  - 🔴 Rouge = cohérence faible (< 30%)
  - 🟡 Jaune = cohérence moyenne (30-60%)
  - 🟢 Vert = bonne cohérence (> 60%)
- Le **guide audio** (si activé) émet un ton montant à l'inspiration, descendant à l'expiration, avec un fond sonore apaisant
- La **jauge de cohérence** en bas montre le score en temps réel
- Le timer compte à rebours avec le nombre de cycles effectués
- Le BPM en direct est affiché

**Conseils pendant l'exercice :**
- Demander au client de respirer par le nez si possible
- Encourager la respiration abdominale (le ventre monte, pas la poitrine)
- Ne pas parler pendant l'exercice — laisser le guide visuel/audio faire le travail
- Observer la jauge de cohérence : si elle reste rouge après 3-4 min, le protocole est peut-être trop exigeant
- **Changer de thème visuel** en cours de séance si le client semble s'ennuyer — les 3 ambiances (Océan, Aurore, Géométrie) sont accessibles en un clic pendant l'exercice

**Les thèmes visuels — un outil de motivation :**
- 🌊 **Océan** : ambiance apaisante avec vagues. Idéal pour les premières séances et les profils anxieux
- 🌌 **Aurore** : ambiance contemplative avec aurores boréales. Bien pour les séances du soir et la méditation
- ◈ **Géométrie** : mandala sacré évolutif. Plus stimulant intellectuellement, bon pour les clients qui s'ennuient vite
- Dans tous les thèmes, **plus la cohérence monte, plus le visuel devient beau** — le client est naturellement motivé à bien respirer pour "illuminer" l'animation

Cliquer **"Terminer l'exercice"** quand le timer arrive à zéro (ou avant si nécessaire)

### Phase 5 — Mesure post-séance (3-5 min)
- Même procédure que la mesure pré-séance
- Le client reste calme, respiration naturelle
- Cliquer **"Mesure post-séance"** → enregistrer → **"Arrêter la mesure"**
- Vous pouvez aussi cliquer "Passer" si vous manquez de temps (la comparaison ne sera pas disponible)

### Phase 6 — Questionnaire post-séance (1 min)
- Le client évalue : bien-être, stress, difficulté de l'exercice, changement ressenti
- Ce croisement subjectif + objectif est la vraie valeur de VitalCoach

### Phase 7 — Notes du coach (1-2 min)
- Notez vos observations : contexte du client, points remarquables, axes de travail pour la prochaine séance
- Ces notes sont enregistrées dans l'historique et réapparaissent dans le rapport

### Phase 8 — Bilan final
- Vue complète : delta questionnaires, comparaison métriques avant/après avec pourcentages, aide à la décision, notes
- Cliquer **📄 Rapport** pour télécharger le rapport de séance
- **Nouvelle séance** pour revenir à l'accueil

---

## 5. RECHERCHE DE FRÉQUENCE DE RÉSONANCE

### Quand la faire ?
- **Première séance** d'un nouveau client (idéalement)
- Durée : ~12 minutes
- Le client doit porter la ceinture H10

### Comment ça marche ?
Écran d'accueil → Fiche client → Bouton **"🎯 Résonance"**

L'app guide le client à travers 5 fréquences respiratoires :
1. 6.5 respirations/min (cycle 9.2s)
2. 6.0 respirations/min (cycle 10s)
3. 5.5 respirations/min (cycle 10.9s)
4. 5.0 respirations/min (cycle 12s)
5. 4.5 respirations/min (cycle 13.3s)

À chaque palier (2 minutes), l'app mesure le RMSSD. Le palier où le RMSSD est le plus élevé = la fréquence de résonance du client.

### Résultat
- Un graphique en barres montre les résultats des 5 fréquences
- La meilleure est identifiée automatiquement
- Cliquer **"Enregistrer dans le profil client"** pour sauvegarder
- Lors des séances suivantes, quand l'app recommande le protocole "Résonance", elle utilisera automatiquement la fréquence personnalisée du client

### Pourquoi c'est important ?
La fréquence de résonance varie d'une personne à l'autre (généralement entre 4.5 et 6.5 resp/min). Utiliser la fréquence personnalisée produit une amplification maximale de la variabilité cardiaque — c'est significativement plus efficace que le 5.5/min générique.

---

## 6. COMPRENDRE LES MÉTRIQUES

### RMSSD (ms) — La métrique reine
- **Ce que c'est** : mesure la variabilité entre battements successifs
- **Ce que ça dit** : activité du système nerveux parasympathique (le "frein" du corps)
- **Plus c'est haut, mieux c'est** (dans les limites de l'âge/sexe)
- **Valeurs typiques** : 15-50 ms selon l'âge. Voir le tableau des normes dans l'app

### SDNN (ms) — Variabilité globale
- **Ce que c'est** : écart-type de tous les intervalles RR
- **Ce que ça dit** : capacité d'adaptation globale du système nerveux
- **Plus c'est haut, mieux c'est**

### pNN50 (%) — Tonus vagal
- **Ce que c'est** : pourcentage de battements successifs différant de plus de 50ms
- **Ce que ça dit** : activité vagale pure
- **> 20% = bon** • **< 5% = très bas**

### FC moyenne (bpm) — Fréquence cardiaque
- **Au repos : 60-75 bpm = normal** • **< 60 bpm = bonne condition** • **> 85 bpm = activation sympathique**
- Un client stressé ou déréglé aura souvent une FC repos élevée

### Stress Index (Baevsky) — Charge sympathique
- **< 80 = détendu** • **80-150 = modéré** • **> 150 = stress élevé** • **> 200 = stress aigu**
- Indice composite qui intègre la distribution des intervalles RR

### LF/HF — Équilibre autonomique
- **< 1.5 = dominance parasympathique** (bien au repos)
- **1.5-2.5 = zone neutre**
- **> 2.5 = dominance sympathique** (stress, activation)

### Cohérence (%) — Synchronisation cardio-respiratoire
- **> 60% = bonne cohérence** (respiration et cœur synchronisés)
- **30-60% = partielle**
- **< 30% = faible** (la respiration n'influence pas encore le rythme cardiaque)

---

## 7. LIRE LE DIAGNOSTIC ET LA RECOMMANDATION

### Le diagnostic
L'app génère des "findings" avec 3 niveaux :
- ✅ **Bon** (vert) — métrique dans la bonne fourchette
- ℹ️ **Info** (neutre) — observation contextuelle, pas d'alerte
- ⚠️ **Attention** (jaune) — métrique hors norme, à surveiller

Les findings sont **contextualisés** selon le profil du client :
- Un RMSSD de 25ms sera "dans la moyenne" pour un homme de 55 ans mais "inférieur à la norme" pour une femme de 28 ans
- Si le client a déclaré un contexte COVID long et que son profil HRV correspond, l'app le mentionne

### La recommandation
L'app propose le protocole le mieux adapté selon cette logique :

| Profil détecté | Protocole | Pourquoi |
|----------------|-----------|----------|
| Vulnérable + HRV très bas | **Respiration douce 3-5** | Rythme court et doux, accessible même en dysautonomie |
| Stress aigu | **4-7-8** (ou 4-6 si vulnérable) | Expiration longue = activation vagale forte |
| Stress modéré | **Cohérence 4-6** | Ratio 2:3 pousse doucement vers le parasympathique |
| HRV correct, cohérence basse | **Résonance** | Synchronisation cardio-respiratoire optimale |
| Bon état | **Cohérence 5-5** | Maintien et consolidation |

**Vous pouvez toujours overrider** — un bandeau orange vous signale que vous avez choisi un protocole différent de la recommandation.

---

## 8. GUIDE DES EXERCICES DE RESPIRATION

### Respiration douce 3-5 (nouveau)
- **Inspire 3s → Expire 5s**
- Pour les clients fragiles (COVID long, anxiété sévère, première séance)
- Le rythme court est accessible même en cas de tolérance réduite
- Objectif : réactiver doucement le tonus vagal

### Cohérence cardiaque 5-5
- **Inspire 5s → Expire 5s** (6 resp/min)
- Le protocole standard de cohérence cardiaque
- Équilibre le système nerveux autonome
- Pour les clients en bon état ou en maintien

### Cohérence 4-6
- **Inspire 4s → Expire 6s** (6 resp/min)
- L'expiration allongée favorise le parasympathique
- Pour les clients modérément stressés
- Plus accessible que le 4-7-8

### Respiration 4-7-8
- **Inspire 4s → Rétention 7s → Expire 8s** (~3 resp/min)
- Le plus puissant pour activer le nerf vague
- La rétention amplifie la pression intrathoracique
- Réservé aux clients non-fragiles en stress aigu
- Durée recommandée : 5 min max (fatiguant)

### Résonance personnalisée
- **Rythme adapté au client** (après recherche de résonance)
- Produit l'amplification maximale de la variabilité cardiaque
- Pour les clients ayant déjà effectué la recherche de résonance

---

## 9. LE RAPPORT DE SÉANCE

### Générer un rapport
Écran bilan final → Bouton **"📄 Rapport"**

### Contenu du rapport
- Identité et profil du client
- Date, programme et protocole utilisé
- Questionnaires pré/post avec traduction texte
- Les 7 métriques avant → après avec les pourcentages d'évolution
- Scores de fiabilité
- Aide à la décision
- Notes du coach
- Disclaimer médical

### Utilisation
- Le fichier se télécharge automatiquement
- Le donner au client à la fin de la séance (impression ou email)
- Conserver dans votre dossier client
- Peut être partagé avec un professionnel de santé si le client le souhaite

---

## 10. SUIVI ET HISTORIQUE CLIENT

### Accéder à l'historique
Fiche client → Bouton **"📊 Historique"**

### Ce que vous voyez
- **Graphique d'évolution du RMSSD** pré-séance par séance
- **Liste des séances** avec : date, programme, RMSSD avant → après (%), bien-être avant → après
- La progression dans le temps est le meilleur argument pour fidéliser un client

### Indicateurs de succès à suivre
- RMSSD pré-séance qui monte au fil des séances = le système nerveux récupère
- Stress perçu (questionnaire) qui baisse = le client le ressent
- Delta RMSSD (avant/après) qui se réduit = le client arrive de mieux en mieux régulé
- Cohérence qui monte = le client maîtrise mieux sa respiration

### Intelligence longitudinale (nouveau)
Le tableau de bord intègre un **moteur d'évolution** qui analyse automatiquement les tendances sur plusieurs séances :

**Score de progression (0-100)** — Widget circulaire qui résume la trajectoire globale du client. Prend en compte la tendance RMSSD, la stabilité, et le nombre de séances.

**Détection de plateau** — Si le RMSSD stagne sur 3+ séances, l'app le signale et propose des actions : changer de protocole, faire une recherche de résonance, explorer le volet nutrition/sommeil.

**Alertes de régression** — Si le RMSSD chute de plus de 25% par rapport aux séances précédentes, l'app alerte et suggère d'investiguer un facteur de stress récent.

**Progression de protocole** — L'app recommande automatiquement de passer au protocole suivant quand le client est prêt :
- RMSSD stable > 20ms sur 2+ séances → passer du 3-5 au 4-6
- RMSSD stable > 25ms → bon moment pour la recherche de résonance
- RMSSD stable > 30ms → passer à la Résonance ou au 5-5

**Adaptation de durée** — Si le client rapporte "Facile" sur 3+ séances, l'app suggère d'allonger. Si "Difficile", elle suggère de raccourcir.

**Changement de programme** — Après 5+ séances de Sérénité avec bonne progression, l'app suggère de passer à Équilibre pour intégrer la nutrition.

---

## 11. MODE DÉMO

### À quoi ça sert
- Tester le flow complet sans ceinture Polar H10
- Montrer l'app à un prospect avant qu'il ne s'engage
- Former un autre coach sur le fonctionnement

### Comment l'activer
- Sans client sélectionné : bouton **"Mode démo"** sur l'écran d'accueil
- Avec client mais sans Bluetooth : bouton **"Démo"** dans la zone de connexion

### Ce qui est simulé
- Un client fictif (35 ans, Homme, IMC 24.5) est créé automatiquement
- Les données RR sont générées aléatoirement (physiologiquement réalistes)
- Les métriques post-séance sont légèrement meilleures que le pré (pour montrer l'effet)
- Un badge **DÉMO** est visible dans le header

---

## 12. DÉPANNAGE

### "Le Polar H10 n'apparaît pas dans la liste"
- Vérifier que la ceinture est humidifiée et portée (le H10 se met en veille sans contact peau)
- Vérifier que le Bluetooth est activé sur l'ordinateur
- Vérifier que vous utilisez **Chrome ou Edge** (pas Safari, pas Firefox)
- Vérifier que l'URL est en **HTTPS** (le Bluetooth ne fonctionne pas en HTTP)
- Essayer de retirer et remettre la ceinture

### "Le BPM s'affiche mais pas de RR intervals"
- Certaines ceintures non-Polar n'envoient pas les RR intervals. Le H10 les envoie toujours
- Vérifier que la ceinture est bien positionnée (contact peau ferme)

### "La fiabilité est 'Faible'"
- La mesure était probablement trop courte (< 2 min)
- Ou beaucoup d'artefacts : la ceinture bouge, le client parle ou bouge pendant la mesure
- Solution : refaire la mesure, demander au client de rester immobile et silencieux

### "Le RMSSD est à 0"
- Pas assez de données RR reçues
- La ceinture n'a peut-être pas de bon contact
- Ré-humidifier les électrodes et repositionner

### "L'audio ne fonctionne pas"
- Chrome bloque l'audio tant que l'utilisateur n'a pas interagi avec la page
- Cliquer n'importe où sur l'app avant de lancer l'exercice
- Vérifier que le checkbox "Guide audio activé" est coché
- Vérifier le volume de l'ordinateur

---

## 13. MENTIONS LÉGALES ET LIMITES

### Ce que VitalCoach est
- Un outil d'aide au coaching bien-être
- Un instrument de mesure d'indicateurs physiologiques
- Un support à la pratique de la cohérence cardiaque

### Ce que VitalCoach n'est PAS
- Un dispositif médical
- Un outil de diagnostic
- Un substitut à une consultation médicale

### Quand orienter vers un médecin
- FC repos constamment > 100 bpm sans exercice préalable
- RMSSD systématiquement < 10 ms chez un client < 50 ans
- Le client rapporte des douleurs thoraciques, palpitations intenses, ou malaises
- Aucune amélioration après 5+ séances malgré un protocole adapté
- Le client mentionne des symptômes nouveaux ou inquiétants

### Formule recommandée au client
> *"Les données que nous mesurons ici sont des indicateurs de l'état de votre système nerveux autonome. Ils nous aident à adapter l'accompagnement, mais ne remplacent en aucun cas un bilan médical. Si vous avez le moindre doute sur votre santé, je vous encourage à consulter votre médecin."*

---

*VitalCoach — Mode d'emploi v1.0 — Mars 2026*
