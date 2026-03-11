# VITALCOACH — Fichier Central de Référence

> **Dernière mise à jour :** 11 mars 2026
> **Version :** 1.2.0-beta
> **Auteur :** Farid
> **Rôle Claude :** Chef de projet IT / UX / Développement

---

## 1. VISION PRODUIT

**Pitch :** VitalCoach est une application web de coaching biofeedback qui se connecte à une ceinture Polar H10 via Bluetooth, réalise un bilan physiologique du client avant séance, propose des exercices de respiration visuels guidés adaptés au profil du client, puis mesure l'impact post-séance.

**Positionnement :** Outil professionnel de coaching bien-être et gestion du stress, combinable avec Yifen (nutrition). Adapté aux profils post-COVID, anxieux, burn-out. Pas un dispositif médical.

**Design prévu :** Reskin light style Yifen (fond blanc, accent teal, ombres douces) — prochaine itération.

**Note Windows :** Le H10 doit être appairé dans les paramètres Bluetooth Windows AVANT que Chrome puisse le voir.

---

## 2. FEATURES INTÉGRÉES

### Profil client (pseudo-anonyme)
Pseudo au lieu du nom (privacy RGPD), sexe, âge, poids/taille/IMC, activité, fumeur, médicaments, objectifs, contexte clinique (COVID long, anxiété, burn-out, trauma, etc.), normes HRV par âge/sexe, consentement RGPD obligatoire.

### 12 métriques HRV (7 base + 5 avancées)
Base : RMSSD, SDNN, pNN50, FC moyenne, Stress Index Baevsky, LF/HF, Cohérence.
Avancées : Fréquence respiratoire estimée, Indice de récupération, Entropie d'échantillon (SampEn), DFA α1, Poincaré SD1/SD2.

### Contexte circadien
Heure de mesure contextualisée (matin=cortisol haut, après-midi=parasympathique haut).

### Position de mesure
Assis/Debout/Couché dans le questionnaire pré-séance avec explication de l'impact.

### Recommandation protocole (5 niveaux)
Niveau 0 (vulnérable)→soft 3-5, Niveau 1 (aigu)→4-7-8, Niveau 2 (modéré)→4-6, Niveau 3 (cohérence basse)→résonance, Niveau 4 (bon)→5-5. Override coach possible.

### 6 thèmes visuels Canvas
Océan, Aurore, Géométrie, Forêt, Cosmos, Minimal. Biofeedback gamifié par la cohérence.

### Diagnostic contextuel
Tient compte de : première séance, qualité sommeil, résonance non calibrée. Signaux positifs secondaires détectés.

### Moteur d'évolution longitudinale
Score progression 0-100, détection plateau/régression, suggestions protocole/durée/programme.

### Autres : guide audio, biofeedback RT, timer séance, recherche résonance, export rapport, notes coach, multi-programmes, mode démo, CTA résonance proéminent, reconnexion BLE auto.

---

## 3. DÉCISIONS PRISES

| Décision | Date |
|----------|------|
| Pseudo au lieu du nom (RGPD) | 11/03/2026 |
| Horodatage contextualisé (circadien) | 11/03/2026 |
| 5 métriques avancées RR-only | 11/03/2026 |
| ECG = V3 avec hardware dédié Mac Mini M2 | 11/03/2026 |
| Design light Yifen = prochaine itération | 11/03/2026 |
| Windows : H10 appairé dans paramètres BT | 08/03/2026 |
| Web app standard BLE, pas SDK Polar | 06/03/2026 |
| React + Vite + Vercel | 06/03/2026 |
| Protocole doux 3-5 pour profils vulnérables | 06/03/2026 |

---

## 4. ROADMAP

### V1.3
- [ ] Reskin light Yifen
- [ ] Persistance Supabase
- [ ] Poincaré visuel (scatter plot)

### V2.0
- [ ] Intégration Yifen (nutrition)
- [ ] IA coach (API Claude via Vercel Serverless)
- [ ] Rappels inter-séance
- [ ] Objectifs et jalons

### V3.0 (hardware dédié)
- [ ] Bridge ECG Python (BleakHeart/FastAPI + WebSocket local)
- [ ] Métriques ECG : onde P-QRS-T, QT, EDR, arythmies
- [ ] Accéléromètre : position auto, agitation
- [ ] Mode multi-coach SaaS

---

## 5. DONNÉES PAR SESSION

```json
{
  "id": "timestamp",
  "clientId": "string (pseudo)",
  "date": "ISO 8601",
  "timeContext": { "period", "label", "adjustment" },
  "position": "seated|standing|lying",
  "program": "serenite|equilibre|transformation",
  "preMetrics": { "rmssd","sdnn","pnn50","meanHR","stressIndex","lfhf","coherence","respiratoryRate","recoveryIndex","sampleEntropy","dfa1","poincare":{sd1,sd2,ratio} },
  "postMetrics": "idem",
  "preQ": { "wellbeing","stress","sleep","energy","position","note" },
  "postQ": { "wellbeing","stress","difficulty","feltChange","note" },
  "notes": "string",
  "protocol": "string",
  "breathDuration": "number"
}
```

---

## 6. INSTRUCTIONS POUR CLAUDE

1. Lire ce fichier en premier à chaque session
2. Ne jamais supprimer une feature existante
3. Client = pseudo, jamais nom réel
4. Disclaimer médical partout
5. Prochain design = light Yifen (blanc/teal)
6. Livrer un ZIP buildable Vercel

---

*Source de vérité VitalCoach.*
