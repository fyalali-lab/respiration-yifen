import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================
// VITALCOACH V1 — HRV Biofeedback Coaching Platform
// 12 features: Profil client, Questionnaire pré/post, 
// Résonance, Audio, Biofeedback RT, Timer, Dashboard,
// PDF, Notes, Programmes, RGPD, Mode démo
// ============================================================

// ─── DESIGN TOKENS ───────────────────────────────────────────
const T = {
  bg: "#080c14", bgCard: "rgba(255,255,255,0.025)", bgCardHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.06)", borderActive: "rgba(100,200,255,0.3)",
  text: "#e2ecf5", textMuted: "#6b7d8f", textDim: "#3e5060",
  accent: "#4da6ff", accentGlow: "rgba(77,166,255,0.15)",
  good: "#3ddba0", goodBg: "rgba(61,219,160,0.08)",
  warn: "#f0b542", warnBg: "rgba(240,181,66,0.08)",
  bad: "#f06565", badBg: "rgba(240,101,101,0.08)",
  fontDisplay: "'Outfit', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

// ─── HRV NORMS BY AGE/SEX (Nunan 2010, Shaffer 2017) ────────
const HRV_NORMS = {
  // { rmssd: [low, avg, good], sdnn: [low, avg, good] }
  M: {
    "20-29": { rmssd: [24, 43, 72], sdnn: [32, 50, 78] },
    "30-39": { rmssd: [19, 35, 60], sdnn: [28, 45, 70] },
    "40-49": { rmssd: [15, 28, 48], sdnn: [24, 40, 62] },
    "50-59": { rmssd: [12, 22, 38], sdnn: [20, 35, 55] },
    "60-69": { rmssd: [10, 18, 30], sdnn: [17, 30, 48] },
    "70+":   { rmssd: [8, 15, 25], sdnn: [14, 26, 42] },
  },
  F: {
    "20-29": { rmssd: [22, 39, 66], sdnn: [30, 47, 73] },
    "30-39": { rmssd: [17, 32, 55], sdnn: [26, 42, 65] },
    "40-49": { rmssd: [14, 25, 44], sdnn: [22, 37, 58] },
    "50-59": { rmssd: [11, 20, 35], sdnn: [18, 32, 50] },
    "60-69": { rmssd: [9, 16, 28], sdnn: [15, 28, 44] },
    "70+":   { rmssd: [7, 13, 23], sdnn: [12, 24, 38] },
  }
};

function getAgeGroup(age) {
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70+";
}

function getNorms(sex, age) {
  const s = sex === "F" ? "F" : "M";
  const group = getAgeGroup(age);
  return HRV_NORMS[s][group];
}

function getSeverityForNorms(value, norms, key) {
  const [low, avg, good] = norms[key];
  if (value >= good) return "good";
  if (value >= avg) return "neutral";
  if (value >= low) return "warn";
  return "bad";
}

// ─── HRV ENGINE ──────────────────────────────────────────────
const HRV = {
  filterArtifacts(rr) {
    if (rr.length < 3) return rr;
    return rr.filter((v, i, a) => {
      if (v < 300 || v > 2000) return false;
      if (i > 0 && i < a.length - 1) {
        const local = (a[i-1] + a[i+1]) / 2;
        if (Math.abs(v - local) > local * 0.25) return false;
      }
      return true;
    });
  },
  rmssd(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 2) return 0;
    let s = 0;
    for (let i = 1; i < f.length; i++) s += (f[i]-f[i-1])**2;
    return Math.sqrt(s / (f.length-1));
  },
  sdnn(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 2) return 0;
    const m = f.reduce((a,b)=>a+b,0)/f.length;
    return Math.sqrt(f.reduce((s,v)=>s+(v-m)**2,0)/(f.length-1));
  },
  pnn50(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 2) return 0;
    let c = 0;
    for (let i = 1; i < f.length; i++) if (Math.abs(f[i]-f[i-1]) > 50) c++;
    return (c / (f.length-1)) * 100;
  },
  meanHR(rr) {
    const f = this.filterArtifacts(rr);
    if (!f.length) return 0;
    return 60000 / (f.reduce((a,b)=>a+b,0)/f.length);
  },
  stressIndex(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 10) return null;
    const sorted = [...f].sort((a,b)=>a-b);
    const mode = sorted[Math.floor(sorted.length/2)];
    const amo = f.filter(v => Math.abs(v-mode) < 25).length / f.length * 100;
    const range = sorted[sorted.length-1] - sorted[0];
    if (!range || !mode) return null;
    return (amo / (2 * mode * range / 1000)) * 1000;
  },
  lfhf(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 30) return null;
    const m = f.reduce((a,b)=>a+b,0)/f.length;
    const d = f.map(v=>v-m);
    const n = d.length;
    const sr = 1000/m;
    let lf=0, hf=0;
    for (let k=0; k<n/2; k++) {
      const freq = k*sr/n;
      let re=0, im=0;
      for (let t=0; t<n; t++) {
        const a = 2*Math.PI*k*t/n;
        re += d[t]*Math.cos(a);
        im -= d[t]*Math.sin(a);
      }
      const p = (re*re+im*im)/n;
      if (freq >= 0.04 && freq < 0.15) lf += p;
      if (freq >= 0.15 && freq <= 0.4) hf += p;
    }
    return hf === 0 ? null : lf/hf;
  },
  coherence(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 20) return null;
    const m = f.reduce((a,b)=>a+b,0)/f.length;
    const d = f.map(v=>v-m);
    const n = d.length;
    const sr = 1000/m;
    let peak=0, total=0;
    for (let k=1; k<n/2; k++) {
      const freq = k*sr/n;
      let re=0, im=0;
      for (let t=0; t<n; t++) {
        const a = 2*Math.PI*k*t/n;
        re += d[t]*Math.cos(a);
        im -= d[t]*Math.sin(a);
      }
      const p = (re*re+im*im)/n;
      total += p;
      if (freq >= 0.04 && freq <= 0.26 && p > peak) peak = p;
    }
    return total === 0 ? 0 : Math.min(100, (peak/total)*300);
  },
  reliability(rr, durMs) {
    const artRate = rr.length ? ((rr.length - this.filterArtifacts(rr).length)/rr.length)*100 : 0;
    const minSamples = (durMs/1000) * 0.8;
    const sampleOk = Math.min(100, (this.filterArtifacts(rr).length/minSamples)*100);
    let s = 100 - artRate*0.5 - (100-sampleOk)*0.3;
    if (durMs < 60000) s -= 15;
    if (durMs < 120000) s -= 10;
    return Math.max(0, Math.min(100, Math.round(s)));
  },
  allMetrics(rr) {
    return {
      rmssd: this.rmssd(rr), sdnn: this.sdnn(rr), pnn50: this.pnn50(rr),
      meanHR: this.meanHR(rr), stressIndex: this.stressIndex(rr),
      lfhf: this.lfhf(rr), coherence: this.coherence(rr),
      respiratoryRate: this.respiratoryRate(rr),
      recoveryIndex: this.recoveryIndex(rr),
      sampleEntropy: this.sampleEntropy(rr),
      dfa1: this.dfaAlpha1(rr),
      poincare: this.poincare(rr),
    };
  },

  // ── NEW: Respiratory Rate estimated from RR oscillations ──
  respiratoryRate(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 30) return null;
    const m = f.reduce((a,b)=>a+b,0)/f.length;
    const d = f.map(v=>v-m);
    const n = d.length;
    const sr = 1000/m;
    let maxPow = 0, maxFreq = 0;
    for (let k=1; k<n/2; k++) {
      const freq = k*sr/n;
      if (freq < 0.15 || freq > 0.5) continue; // breathing range 9-30 breaths/min
      let re=0, im=0;
      for (let t=0; t<n; t++) { const a=2*Math.PI*k*t/n; re+=d[t]*Math.cos(a); im-=d[t]*Math.sin(a); }
      const p = re*re+im*im;
      if (p > maxPow) { maxPow = p; maxFreq = freq; }
    }
    return maxFreq > 0 ? maxFreq * 60 : null; // breaths per minute
  },

  // ── NEW: Recovery Index — RMSSD trend within a measurement ──
  recoveryIndex(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 40) return null;
    const half = Math.floor(f.length / 2);
    const firstHalf = f.slice(0, half);
    const secondHalf = f.slice(half);
    const rmssd1 = (() => { let s=0; for(let i=1;i<firstHalf.length;i++) s+=(firstHalf[i]-firstHalf[i-1])**2; return Math.sqrt(s/(firstHalf.length-1)); })();
    const rmssd2 = (() => { let s=0; for(let i=1;i<secondHalf.length;i++) s+=(secondHalf[i]-secondHalf[i-1])**2; return Math.sqrt(s/(secondHalf.length-1)); })();
    if (rmssd1 === 0) return null;
    return ((rmssd2 - rmssd1) / rmssd1) * 100; // % change first→second half
  },

  // ── NEW: Sample Entropy (SampEn) — complexity/predictability ──
  sampleEntropy(rr, m = 2, r_factor = 0.2) {
    const f = this.filterArtifacts(rr);
    if (f.length < 30) return null;
    const N = Math.min(f.length, 200); // limit for performance
    const data = f.slice(-N);
    const r = r_factor * this.sdnn(data.length > 2 ? data : rr);
    if (r === 0) return null;
    const countMatches = (templateLen) => {
      let count = 0;
      for (let i = 0; i < N - templateLen; i++) {
        for (let j = i + 1; j < N - templateLen; j++) {
          let match = true;
          for (let k = 0; k < templateLen; k++) {
            if (Math.abs(data[i+k] - data[j+k]) > r) { match = false; break; }
          }
          if (match) count++;
        }
      }
      return count;
    };
    const A = countMatches(m + 1);
    const B = countMatches(m);
    if (B === 0) return null;
    return -Math.log(A / B);
  },

  // ── NEW: DFA Alpha1 — detrended fluctuation analysis ──
  dfaAlpha1(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 30) return null;
    const N = Math.min(f.length, 200);
    const data = f.slice(-N);
    const mean = data.reduce((a,b)=>a+b,0)/N;
    // Integrated signal
    const y = [];
    let cumSum = 0;
    for (let i = 0; i < N; i++) { cumSum += data[i] - mean; y.push(cumSum); }
    // Box sizes
    const boxes = [4, 6, 8, 12, 16, 24, 32].filter(b => b <= N/4);
    if (boxes.length < 3) return null;
    const logN = [], logF = [];
    for (const n of boxes) {
      let totalFluc = 0;
      const numBoxes = Math.floor(N / n);
      for (let b = 0; b < numBoxes; b++) {
        const seg = y.slice(b*n, (b+1)*n);
        // Linear detrend
        const xm = (n-1)/2;
        let sxy=0, sxx=0;
        for (let i=0; i<n; i++) { sxy+=(i-xm)*seg[i]; sxx+=(i-xm)**2; }
        const slope = sxx === 0 ? 0 : sxy/sxx;
        const intercept = seg.reduce((a,b)=>a+b,0)/n - slope*xm;
        let fluc = 0;
        for (let i=0; i<n; i++) fluc += (seg[i] - (intercept + slope*i))**2;
        totalFluc += fluc/n;
      }
      const F = Math.sqrt(totalFluc/numBoxes);
      if (F > 0) { logN.push(Math.log(n)); logF.push(Math.log(F)); }
    }
    if (logN.length < 3) return null;
    // Linear regression log-log
    const lnM = logN.reduce((a,b)=>a+b,0)/logN.length;
    const lfM = logF.reduce((a,b)=>a+b,0)/logF.length;
    let num=0, den=0;
    for (let i=0; i<logN.length; i++) { num+=(logN[i]-lnM)*(logF[i]-lfM); den+=(logN[i]-lnM)**2; }
    return den === 0 ? null : num/den;
  },

  // ── NEW: Poincaré plot SD1/SD2 ──
  poincare(rr) {
    const f = this.filterArtifacts(rr);
    if (f.length < 10) return null;
    let sd1Sum = 0, sd2Sum = 0;
    for (let i = 0; i < f.length - 1; i++) {
      const x = f[i], y = f[i+1];
      sd1Sum += ((x - y) / Math.sqrt(2)) ** 2;
      sd2Sum += ((x + y) / Math.sqrt(2)) ** 2;
    }
    const n = f.length - 1;
    const meanRR = f.reduce((a,b)=>a+b,0)/f.length;
    const sd1 = Math.sqrt(sd1Sum / n);
    const sd2Var = sd2Sum / n - ((f.reduce((a,b)=>a+b,0)*2/f.length) / Math.sqrt(2)) ** 2;
    const sd2 = Math.sqrt(Math.max(0, 2 * this.sdnn(rr) ** 2 - sd1 ** 2));
    const ratio = sd1 > 0 ? sd2 / sd1 : null;
    return { sd1: sd1, sd2: sd2, ratio };
  },

  // ── Circadian context for time-of-day ──
  getTimeContext(hour) {
    if (hour >= 6 && hour < 10) return { period: "morning", label: "Matin (6h-10h)", adjustment: "RMSSD naturellement plus bas — pic de cortisol matinal", factor: -0.1 };
    if (hour >= 10 && hour < 14) return { period: "midday", label: "Mi-journée (10h-14h)", adjustment: "Période neutre", factor: 0 };
    if (hour >= 14 && hour < 18) return { period: "afternoon", label: "Après-midi (14h-18h)", adjustment: "RMSSD naturellement plus élevé — pic parasympathique", factor: 0.1 };
    if (hour >= 18 && hour < 22) return { period: "evening", label: "Soirée (18h-22h)", adjustment: "RMSSD élevé — récupération vespérale", factor: 0.1 };
    return { period: "night", label: "Nuit (22h-6h)", adjustment: "Mesure atypique — SNA en mode sommeil", factor: 0.15 };
  },
  recommendProtocol(metrics, clientProfile) {
    const { rmssd, sdnn, meanHR, stressIndex, lfhf, coherence, pnn50 } = metrics;
    const ctx = clientProfile?.context || [];
    const isVulnerable = ctx.some(c => ["covid_long", "anxiety", "burnout", "trauma"].includes(c));
    const isFirstSession = !clientProfile?.resonanceFreq; // proxy: no resonance = early stage

    // LEVEL 0: Vulnerable profile + very low HRV → soft 3-5 protocol
    // COVID long, severe anxiety, first sessions — don't overwhelm
    if (isVulnerable && (rmssd < 20 || (meanHR > 85 && rmssd < 25))) {
      return { protocol: "soft35", confidence: 90, duration: 240,
        reasons: [
          isVulnerable && "Profil vulnérable identifié (contexte clinique)",
          rmssd < 20 && "RMSSD très bas — système fragilisé",
          meanHR > 85 && "FC repos élevée — dysautonomie possible",
        ].filter(Boolean),
        explain: "Protocole d'entrée progressif avec ratio 3:5 (expire > inspire). Le rythme court et doux est accessible même pour les clients avec tolérance réduite à l'effort respiratoire (dysautonomie post-COVID, anxiété sévère). L'objectif est de réactiver le tonus vagal sans déclencher d'hyperventilation ou de malaise." };
    }

    // LEVEL 1: Acute stress / sympathetic overdrive
    if (rmssd < 18 || (stressIndex !== null && stressIndex > 200) || (meanHR > 90 && rmssd < 25) || (lfhf !== null && lfhf > 4 && rmssd < 20)) {
      // If vulnerable, downgrade from 4-7-8 to 4-6 (less aggressive)
      if (isVulnerable) {
        return { protocol: "coherence46", confidence: 88, duration: 300,
          reasons: [rmssd<18&&"RMSSD très bas", stressIndex>200&&"Stress index élevé", "Protocole adapté au profil vulnérable (4-6 au lieu de 4-7-8)"].filter(Boolean),
          explain: "Le 4-7-8 serait trop exigeant pour un profil fragilisé. Le 4-6 offre un ratio d'expiration prolongée efficace sans rétention, plus accessible et sans risque de malaise." };
      }
      return { protocol: "box478", confidence: 92, duration: 300,
        reasons: [rmssd<18&&"RMSSD très bas", stressIndex>200&&"Stress index élevé", meanHR>90&&"FC repos élevée"].filter(Boolean),
        explain: "Expiration prolongée (8s) pour activation vagale intensive. Rétention (7s) amplifie le baroréflexe." };
    }

    // LEVEL 2: Moderate sympathetic dominance
    if ((rmssd>=18&&rmssd<25&&meanHR>75) || (lfhf!==null&&lfhf>2.5&&lfhf<=4) || (stressIndex!==null&&stressIndex>120&&stressIndex<=200)) {
      return { protocol: "coherence46", confidence: 87, duration: 300,
        reasons: [rmssd<25&&"RMSSD modéré", lfhf>2.5&&"Déséquilibre SNA", meanHR>75&&"FC légèrement élevée"].filter(Boolean),
        explain: "Ratio 2:3 inspire/expire favorise progressivement le parasympathique sans brusquer le système." };
    }

    // LEVEL 3: Decent HRV but low coherence
    if ((rmssd>=25&&coherence!==null&&coherence<35) || (sdnn>=30&&coherence!==null&&coherence<30)) {
      return { protocol: "resonance", confidence: 84, duration: 420,
        reasons: [coherence<35&&"Cohérence basse malgré HRV correct", rmssd>=25&&"Capacité de régulation présente"].filter(Boolean),
        explain: "Respiration à la fréquence de résonance pour synchronisation cardio-respiratoire maximale." };
    }

    // LEVEL 4: Good state
    return { protocol: "coherence55", confidence: 80, duration: 300,
      reasons: [rmssd>=30&&"Bon RMSSD", meanHR<75&&"FC repos optimale"].filter(Boolean),
      explain: "Protocole standard de maintien. Équilibre SNA sans forcer." };
  },
  generateDiagnostic(metrics, reliability, clientProfile) {
    const { rmssd, sdnn, pnn50, meanHR, stressIndex, lfhf, coherence } = metrics;
    const findings = [];
    let overallState = "neutral";
    const norms = clientProfile ? getNorms(clientProfile.sex, clientProfile.age) : null;

    if (norms) {
      const sev = getSeverityForNorms(rmssd, norms, "rmssd");
      if (sev === "bad" || sev === "warn") {
        findings.push({ text: `RMSSD (${rmssd.toFixed(1)} ms) inférieur à la moyenne pour ${clientProfile.sex === "F" ? "une femme" : "un homme"} de ${clientProfile.age} ans`, severity: "warning" });
        overallState = sev === "bad" ? "stressed" : "moderate";
      } else if (sev === "good") {
        findings.push({ text: `RMSSD (${rmssd.toFixed(1)} ms) supérieur à la norme pour votre profil — excellent`, severity: "good" });
        overallState = "relaxed";
      } else {
        findings.push({ text: `RMSSD (${rmssd.toFixed(1)} ms) dans la moyenne pour votre profil`, severity: "info" });
        overallState = "moderate";
      }
    } else {
      if (rmssd < 20) { findings.push({ text: "Activité parasympathique faible — mode alerte", severity: "warning" }); overallState = "stressed"; }
      else if (rmssd < 30) { findings.push({ text: "Activité parasympathique modérée", severity: "info" }); overallState = "moderate"; }
      else { findings.push({ text: "Bonne activité parasympathique", severity: "good" }); overallState = "relaxed"; }
    }

    if (sdnn < 30) findings.push({ text: "Variabilité cardiaque réduite", severity: "warning" });
    else if (sdnn >= 50) findings.push({ text: "Variabilité cardiaque élevée — bonne adaptabilité", severity: "good" });
    if (meanHR > 85) findings.push({ text: `FC repos élevée (${Math.round(meanHR)} bpm)`, severity: "warning" });
    else if (meanHR < 65) findings.push({ text: `FC repos basse (${Math.round(meanHR)} bpm) — bonne condition vagale`, severity: "good" });
    if (stressIndex !== null && stressIndex > 150) findings.push({ text: "Indice de stress élevé", severity: "warning" });
    if (lfhf !== null && lfhf > 2.5) findings.push({ text: "Dominance sympathique marquée", severity: "warning" });

    // Context-specific findings
    const ctx = clientProfile?.context || [];
    if (ctx.includes("covid_long") && rmssd < 25 && meanHR > 75) {
      findings.push({ text: "Profil cohérent avec une dysautonomie post-infectieuse (COVID long) — FC élevée + HRV bas", severity: "info" });
    }
    if (ctx.includes("anxiety") && stressIndex !== null && stressIndex > 100) {
      findings.push({ text: "Activation sympathique élevée — cohérent avec le contexte anxieux déclaré", severity: "info" });
    }
    if (ctx.includes("burnout") && rmssd < 20 && sdnn < 30) {
      findings.push({ text: "Variabilité très réduite — profil compatible avec un épuisement du système nerveux autonome", severity: "info" });
    }
    if (ctx.includes("sleep_disorder") && meanHR > 80) {
      findings.push({ text: "FC repos élevée possiblement liée aux troubles du sommeil déclarés", severity: "info" });
    }

    if (reliability < 70) findings.unshift({ text: `Fiabilité : ${reliability}% — interpréter avec prudence`, severity: "warning" });

    const reco = this.recommendProtocol(metrics, clientProfile);
    return { findings, overallState, recommendedProtocol: reco };
  }
};

// ─── AUDIO ENGINE ────────────────────────────────────────────
const AudioEngine = {
  ctx: null,
  gainNode: null,
  oscNode: null,
  bgGainNode: null,
  bgNoiseNode: null,
  bgBufferSource: null,
  
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(this.ctx.destination);
    this.bgGainNode = this.ctx.createGain();
    this.bgGainNode.gain.value = 0;
    this.bgGainNode.connect(this.ctx.destination);
  },
  
  startBreathTone() {
    this.init();
    if (this.oscNode) return;
    this.oscNode = this.ctx.createOscillator();
    this.oscNode.type = "sine";
    this.oscNode.frequency.value = 220;
    this.oscNode.connect(this.gainNode);
    this.oscNode.start();
    this.gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
  },
  
  updateBreathTone(phase, progress) {
    if (!this.oscNode || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (phase === "inhale") {
      this.oscNode.frequency.setTargetAtTime(220 + 220 * progress, t, 0.1);
      this.gainNode.gain.setTargetAtTime(0.08 + 0.06 * progress, t, 0.05);
    } else if (phase === "exhale") {
      this.oscNode.frequency.setTargetAtTime(440 - 220 * progress, t, 0.1);
      this.gainNode.gain.setTargetAtTime(0.14 - 0.06 * progress, t, 0.05);
    } else if (phase === "hold" || phase === "holdOut") {
      this.gainNode.gain.setTargetAtTime(0.03, t, 0.2);
    }
  },
  
  startBgSound() {
    this.init();
    // Pink noise-ish background
    const bufSize = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i=0; i<bufSize; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.04;
      b6 = w*0.115926;
    }
    this.bgBufferSource = this.ctx.createBufferSource();
    this.bgBufferSource.buffer = buf;
    this.bgBufferSource.loop = true;
    this.bgBufferSource.connect(this.bgGainNode);
    this.bgBufferSource.start();
    this.bgGainNode.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.5);
  },
  
  stop() {
    if (this.oscNode) { this.oscNode.stop(); this.oscNode = null; }
    if (this.bgBufferSource) { this.bgBufferSource.stop(); this.bgBufferSource = null; }
    if (this.gainNode) this.gainNode.gain.value = 0;
    if (this.bgGainNode) this.bgGainNode.gain.value = 0;
  }
};

// ─── PROTOCOLS ───────────────────────────────────────────────
const PROTOCOLS = {
  soft35: { name: "Respiration douce 3-5", inhale: 3, hold: 0, exhale: 5, holdOut: 0, desc: "Inspire 3s — Expire 5s — Entrée progressive" },
  coherence55: { name: "Cohérence 5-5", inhale: 5, hold: 0, exhale: 5, holdOut: 0, desc: "Inspire 5s — Expire 5s" },
  coherence46: { name: "Cohérence 4-6", inhale: 4, hold: 0, exhale: 6, holdOut: 0, desc: "Inspire 4s — Expire 6s" },
  box478: { name: "Respiration 4-7-8", inhale: 4, hold: 7, exhale: 8, holdOut: 0, desc: "Inspire 4s — Retenir 7s — Expire 8s" },
  resonance: { name: "Résonance 5.5/min", inhale: 5.45, hold: 0, exhale: 5.45, holdOut: 0, desc: "Inspire 5.5s — Expire 5.5s" },
  resonanceCustom: { name: "Résonance personnalisée", inhale: 5, hold: 0, exhale: 5, holdOut: 0, desc: "Fréquence de résonance du client" },
};

const PROGRAMS = {
  serenite: { name: "Sérénité", duration: "40 min", icon: "🌙", color: "#4da6ff", phases: { pre: 5, exercise: 20, post: 5, debrief: 10 }, desc: "Focus stress — Régulation du système nerveux autonome" },
  equilibre: { name: "Équilibre", duration: "1h", icon: "⚖️", color: "#3ddba0", phases: { pre: 5, exercise: 25, post: 5, debrief: 25 }, desc: "Stress + nutrition — Accompagnement global" },
  transformation: { name: "Transformation", duration: "1h30", icon: "🔥", color: "#f0b542", phases: { pre: 5, exercise: 30, post: 5, debrief: 50 }, desc: "Programme complet — Biofeedback, nutrition, éducation" },
};

// ─── EVOLUTION ENGINE (longitudinal adaptation) ──────────────
const EvolutionEngine = {
  analyze(sessions, clientProfile) {
    if (!sessions || sessions.length < 2) return null;
    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const preRmssdValues = sorted.map(s => s.preMetrics?.rmssd).filter(v => v != null);
    const last3 = preRmssdValues.slice(-3);
    const last5 = preRmssdValues.slice(-5);
    const first3 = preRmssdValues.slice(0, 3);

    // Overall trend
    const firstAvg = first3.length ? first3.reduce((a, b) => a + b, 0) / first3.length : 0;
    const lastAvg = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    const overallChange = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    // Plateau detection: variance of last 3-4 sessions < 10%
    const isPlateaued = last3.length >= 3 && (() => {
      const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
      return last3.every(v => Math.abs(v - avg) / avg < 0.1);
    })();

    // Regression detection: last session significantly lower than avg of previous 3
    const isRegressing = last5.length >= 4 && (() => {
      const prev3Avg = last5.slice(-4, -1).reduce((a, b) => a + b, 0) / 3;
      const lastVal = last5[last5.length - 1];
      return lastVal < prev3Avg * 0.75; // 25% drop
    })();

    // Protocol progression readiness
    const lastProtocols = sorted.slice(-3).map(s => s.protocol);
    const currentProto = lastProtocols[lastProtocols.length - 1];
    const stableAbove20 = last3.length >= 2 && last3.every(v => v > 20);
    const stableAbove25 = last3.length >= 2 && last3.every(v => v > 25);
    const stableAbove30 = last3.length >= 2 && last3.every(v => v > 30);

    // Duration adaptation
    const lastDifficulties = sorted.slice(-3).map(s => s.postQ?.difficulty).filter(v => v != null);
    const avgDifficulty = lastDifficulties.length ? lastDifficulties.reduce((a, b) => a + b, 0) / lastDifficulties.length : 2;

    // Progress score 0-100
    const progressScore = Math.max(0, Math.min(100, 50 + overallChange * 0.5 + (stableAbove25 ? 15 : 0) + (preRmssdValues.length * 2)));

    // Build recommendations
    const insights = [];
    const actions = [];

    // Progression
    if (overallChange > 20) {
      insights.push({ type: "good", text: `Progression de ${overallChange.toFixed(0)}% depuis la première séance — trajectoire très positive` });
    } else if (overallChange > 5) {
      insights.push({ type: "good", text: `Amélioration de ${overallChange.toFixed(0)}% du RMSSD de baseline` });
    } else if (overallChange < -10) {
      insights.push({ type: "bad", text: `RMSSD en recul de ${Math.abs(overallChange).toFixed(0)}% — identifier les facteurs externes` });
    }

    // Plateau
    if (isPlateaued) {
      insights.push({ type: "warn", text: "Plateau détecté sur les 3 dernières séances — le RMSSD stagne" });
      actions.push("Envisager un changement de protocole respiratoire");
      if (!clientProfile?.resonanceFreq) actions.push("Effectuer une recherche de fréquence de résonance");
      actions.push("Explorer le volet nutritionnel / sommeil / activité physique");
    }

    // Regression
    if (isRegressing) {
      insights.push({ type: "bad", text: "Régression détectée — RMSSD en baisse significative par rapport aux séances précédentes" });
      actions.push("Investiguer un facteur de stress récent (questionnaire pré-séance)");
      actions.push("Envisager un retour à un protocole plus doux");
    }

    // Protocol upgrade suggestions
    if (currentProto === "soft35" && stableAbove20) {
      actions.push("⬆️ Le client est prêt pour passer au protocole Cohérence 4-6 (RMSSD stable > 20ms)");
    }
    if ((currentProto === "coherence46" || currentProto === "coherence55") && stableAbove25 && !clientProfile?.resonanceFreq) {
      actions.push("⬆️ RMSSD stable > 25ms — bon moment pour une recherche de fréquence de résonance");
    }
    if (currentProto === "coherence46" && stableAbove30) {
      actions.push("⬆️ Le client est prêt pour la Résonance ou la Cohérence 5-5 (RMSSD stable > 30ms)");
    }

    // Duration adaptation
    if (avgDifficulty <= 1.5 && sorted.length >= 3) {
      actions.push("⏱️ Le client rapporte les exercices comme faciles — augmenter la durée (+2-3 min)");
    }
    if (avgDifficulty >= 3.5) {
      actions.push("⏱️ Le client trouve les exercices difficiles — réduire la durée ou passer à un protocole plus doux");
    }

    // Program upgrade
    const currentProgram = sorted[sorted.length - 1]?.program;
    if (currentProgram === "serenite" && sorted.length >= 5 && overallChange > 15) {
      actions.push("📋 Progression solide après 5+ séances Sérénité — proposer le programme Équilibre pour intégrer la nutrition");
    }

    return {
      overallChange: overallChange.toFixed(1),
      progressScore: Math.round(progressScore),
      isPlateaued,
      isRegressing,
      sessionCount: sorted.length,
      firstRmssd: first3.length ? first3[0].toFixed(1) : null,
      lastRmssd: last3.length ? last3[last3.length - 1].toFixed(1) : null,
      insights,
      actions,
    };
  }
};

function Btn({ children, variant = "primary", onClick, disabled, style = {}, full }) {
  const base = {
    fontFamily: T.fontBody, fontSize: "14px", fontWeight: 600, padding: "12px 24px",
    borderRadius: "10px", border: "none", cursor: disabled ? "default" : "pointer",
    letterSpacing: "0.2px", transition: "all 0.2s", width: full ? "100%" : "auto",
    opacity: disabled ? 0.4 : 1, ...style,
  };
  const variants = {
    primary: { background: `linear-gradient(135deg, ${T.accent}, #2b7de9)`, color: "#fff", boxShadow: `0 3px 12px ${T.accentGlow}` },
    secondary: { background: T.bgCard, color: T.text, border: `1px solid ${T.border}` },
    danger: { background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", boxShadow: "0 3px 12px rgba(239,68,68,0.2)" },
    success: { background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", boxShadow: "0 3px 12px rgba(16,185,129,0.2)" },
    ghost: { background: "transparent", color: T.textMuted, padding: "8px 16px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "14px",
      padding: "18px", cursor: onClick ? "pointer" : "default",
      transition: "all 0.15s", ...style,
    }}>{children}</div>
  );
}

function Metric({ label, value, unit, severity = "neutral", compact }) {
  const colors = { good: T.good, warn: T.warn, bad: T.bad, neutral: T.text };
  const c = colors[severity] || T.text;
  return (
    <div style={{ flex: 1, minWidth: compact ? "90px" : "130px" }}>
      <div style={{ fontFamily: T.fontBody, fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "4px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span style={{ fontFamily: T.fontMono, fontSize: compact ? "20px" : "26px", color: c, fontWeight: 700 }}>
          {value !== null && value !== undefined ? (typeof value === "number" ? value.toFixed(1) : value) : "—"}
        </span>
        {unit && <span style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textDim }}>{unit}</span>}
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step = 1, format }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontFamily: T.fontBody, fontSize: "12px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</span>
        <span style={{ fontFamily: T.fontMono, fontSize: "13px", color: T.accent, fontWeight: 600 }}>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.accent }} />
    </div>
  );
}

function EmojiScale({ value, onChange, labels }) {
  const emojis = ["😫", "😟", "😐", "🙂", "😊"];
  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
      {emojis.map((e, i) => (
        <div key={i} onClick={() => onChange(i + 1)}
          style={{
            width: "52px", height: "52px", borderRadius: "12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", cursor: "pointer", transition: "all 0.15s",
            background: value === i + 1 ? T.accentGlow : T.bgCard,
            border: `2px solid ${value === i + 1 ? T.accent : T.border}`,
            transform: value === i + 1 ? "scale(1.12)" : "scale(1)",
          }}>{e}</div>
      ))}
      {labels && <div style={{ display: "flex", justifyContent: "space-between", width: "100%", position: "absolute", bottom: "-18px", left: 0 }}>
        <span style={{ fontSize: "9px", color: T.textDim }}>{labels[0]}</span>
        <span style={{ fontSize: "9px", color: T.textDim }}>{labels[1]}</span>
      </div>}
    </div>
  );
}

function ReliabilityBadge({ score }) {
  const c = score >= 85 ? T.good : score >= 65 ? T.warn : T.bad;
  const l = score >= 85 ? "FIABLE" : score >= 65 ? "ACCEPTABLE" : "FAIBLE";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "16px", background: `${c}12`, border: `1px solid ${c}30` }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: c }} />
      <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: c, fontWeight: 600 }}>{score}% {l}</span>
    </span>
  );
}

// ─── VISUAL THEMES ENGINE (Canvas-based) ─────────────────────
const THEMES = {
  ocean: { name: "Océan", icon: "🌊", desc: "Vagues et écume" },
  aurora: { name: "Aurore", icon: "🌌", desc: "Aurores boréales" },
  geometry: { name: "Géométrie", icon: "◈", desc: "Mandala sacré" },
  forest: { name: "Forêt", icon: "🌳", desc: "Arbre vivant" },
  cosmos: { name: "Cosmos", icon: "✦", desc: "Nébuleuse et étoiles" },
  minimal: { name: "Minimal", icon: "○", desc: "Formes pures" },
};

function BreathingVisual({ phase, progress, label, coherenceScore, audioEnabled, theme = "ocean", width = 320, height = 320 }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (audioEnabled) AudioEngine.updateBreathTone(phase, progress);
  }, [phase, progress, audioEnabled]);

  const getScale = () => {
    if (phase === "inhale") return 0.4 + 0.6 * progress;
    if (phase === "hold") return 1;
    if (phase === "exhale") return 1 - 0.6 * progress;
    if (phase === "holdOut") return 0.4;
    return 0.45;
  };

  const coh = coherenceScore !== null ? coherenceScore / 100 : 0.3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const cx = width / 2, cy = height / 2;
    const scale = getScale();
    const frame = frameRef.current++;
    const t = frame * 0.02;

    ctx.clearRect(0, 0, width, height);

    // ── OCEAN THEME ──
    if (theme === "ocean") {
      // Background gradient: deep blue → turquoise based on coherence
      const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, width * 0.7);
      bg.addColorStop(0, `rgba(${10 + coh * 30}, ${40 + coh * 80}, ${80 + coh * 60}, 1)`);
      bg.addColorStop(1, `rgba(5, 15, 35, 1)`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Waves
      for (let w = 0; w < 4; w++) {
        ctx.beginPath();
        const waveY = cy + (w - 1.5) * 30 * scale;
        const amp = 15 + coh * 20 + w * 5;
        const freq = 0.015 + w * 0.005;
        const speed = t * (1 + w * 0.3);
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= width; x += 3) {
          const y = waveY + Math.sin(x * freq + speed) * amp * scale
            + Math.sin(x * freq * 2.3 + speed * 0.7) * amp * 0.3 * scale;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const alpha = 0.06 + coh * 0.08 + w * 0.02;
        ctx.fillStyle = `rgba(${80 + coh * 120}, ${180 + coh * 40}, ${220 + coh * 35}, ${alpha})`;
        ctx.fill();
      }

      // Central orb (water sphere)
      const orbR = scale * 65;
      const orbGrad = ctx.createRadialGradient(cx - orbR * 0.2, cy - orbR * 0.2, orbR * 0.1, cx, cy, orbR);
      orbGrad.addColorStop(0, `rgba(${140 + coh * 80}, ${220 + coh * 35}, 255, 0.9)`);
      orbGrad.addColorStop(0.6, `rgba(${60 + coh * 80}, ${140 + coh * 60}, ${220}, 0.6)`);
      orbGrad.addColorStop(1, `rgba(30, 80, 160, 0.1)`);
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // Foam particles
      if (particlesRef.current.length < 30) {
        particlesRef.current.push({
          x: Math.random() * width, y: cy + (Math.random() - 0.5) * 100,
          vx: (Math.random() - 0.5) * 0.5, vy: -Math.random() * 0.3,
          r: 1 + Math.random() * 2, life: 1,
        });
      }
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.005;
        if (p.life <= 0) return false;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 230, 255, ${p.life * coh * 0.6})`;
        ctx.fill();
        return true;
      });
    }

    // ── AURORA THEME ──
    else if (theme === "aurora") {
      // Dark sky
      ctx.fillStyle = "#050a18";
      ctx.fillRect(0, 0, width, height);

      // Stars
      for (let i = 0; i < 20; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * width;
        const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * height * 0.4;
        const blink = 0.3 + Math.sin(t * 2 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${blink})`;
        ctx.fill();
      }

      // Aurora bands
      for (let band = 0; band < 5; band++) {
        ctx.beginPath();
        const baseY = height * 0.25 + band * 25;
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= width; x += 2) {
          const wave = Math.sin(x * 0.01 + t * 0.5 + band * 1.2) * 30 * scale
            + Math.sin(x * 0.025 + t * 0.3 + band * 0.8) * 15 * scale;
          ctx.lineTo(x, baseY + wave);
        }
        ctx.lineTo(width, baseY + 60);
        ctx.lineTo(0, baseY + 60);
        ctx.closePath();
        // Color shifts with coherence: purple→blue→green→cyan
        const hue = 200 + coh * 120 + band * 25;
        const sat = 60 + coh * 30;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${40 + coh * 20}%, ${0.12 + coh * 0.08})`;
        ctx.fill();
      }

      // Central light pillar
      const pillarW = 60 + scale * 80;
      const pillarGrad = ctx.createLinearGradient(cx - pillarW / 2, 0, cx + pillarW / 2, 0);
      pillarGrad.addColorStop(0, "transparent");
      pillarGrad.addColorStop(0.3, `hsla(${180 + coh * 80}, 70%, 60%, ${0.08 * scale})`);
      pillarGrad.addColorStop(0.5, `hsla(${160 + coh * 80}, 80%, 70%, ${0.15 * scale})`);
      pillarGrad.addColorStop(0.7, `hsla(${180 + coh * 80}, 70%, 60%, ${0.08 * scale})`);
      pillarGrad.addColorStop(1, "transparent");
      ctx.fillStyle = pillarGrad;
      ctx.fillRect(cx - pillarW / 2, 0, pillarW, height);

      // Orb
      const aOrbR = scale * 50;
      const aGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, aOrbR);
      aGrad.addColorStop(0, `hsla(${160 + coh * 80}, 80%, 80%, 0.9)`);
      aGrad.addColorStop(0.5, `hsla(${180 + coh * 60}, 70%, 50%, 0.5)`);
      aGrad.addColorStop(1, `hsla(${200 + coh * 40}, 60%, 30%, 0.05)`);
      ctx.beginPath();
      ctx.arc(cx, cy, aOrbR, 0, Math.PI * 2);
      ctx.fillStyle = aGrad;
      ctx.fill();
      // Glow
      ctx.shadowColor = `hsla(${160 + coh * 80}, 80%, 60%, ${0.3 + coh * 0.4})`;
      ctx.shadowBlur = 30 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, aOrbR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${160 + coh * 80}, 80%, 80%, ${0.3 * scale})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Light particles rising
      if (particlesRef.current.length < 25) {
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 80, y: height,
          vy: -0.5 - Math.random() * 1, r: 1 + Math.random() * 1.5, life: 1,
          hue: 160 + Math.random() * 80,
        });
      }
      particlesRef.current = particlesRef.current.filter(p => {
        p.y += p.vy; p.x += Math.sin(p.y * 0.02 + t) * 0.5; p.life -= 0.004;
        if (p.life <= 0 || p.y < 0) return false;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * coh, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${p.life * 0.5})`;
        ctx.fill();
        return true;
      });
    }

    // ── GEOMETRY THEME ──
    else if (theme === "geometry") {
      // Dark background with subtle grain
      ctx.fillStyle = "#08060f";
      ctx.fillRect(0, 0, width, height);

      const layers = Math.floor(3 + coh * 5); // More layers = higher coherence
      const maxR = scale * 120;

      for (let layer = 0; layer < layers; layer++) {
        const r = maxR * (0.3 + layer * 0.15);
        const sides = 3 + layer; // Triangle→square→pentagon→hex...
        const rotation = t * 0.2 * (layer % 2 === 0 ? 1 : -1) + layer * 0.3;
        const alpha = 0.15 + coh * 0.15 - layer * 0.02;
        
        // Mandala polygon
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const angle = (i / sides) * Math.PI * 2 + rotation;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        const hue = 280 + coh * 60 + layer * 15;
        ctx.strokeStyle = `hsla(${hue}, ${50 + coh * 30}%, ${40 + coh * 30}%, ${Math.max(0, alpha)})`;
        ctx.lineWidth = 1 + coh;
        ctx.stroke();

        // Inner connecting lines
        if (layer > 0 && coh > 0.3) {
          const innerR = maxR * (0.3 + (layer - 1) * 0.15);
          const innerSides = 2 + layer;
          for (let i = 0; i < sides; i++) {
            const a1 = (i / sides) * Math.PI * 2 + rotation;
            const a2 = (i / innerSides) * Math.PI * 2 + rotation * -0.7;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
            ctx.lineTo(cx + Math.cos(a2) * innerR, cy + Math.sin(a2) * innerR);
            ctx.strokeStyle = `hsla(${hue + 20}, 60%, 50%, ${Math.max(0, alpha * 0.4)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Center circle pulsing
      const centerR = scale * 25;
      const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerR);
      cGrad.addColorStop(0, `hsla(${280 + coh * 60}, 80%, 80%, 0.8)`);
      cGrad.addColorStop(0.5, `hsla(${300 + coh * 40}, 60%, 50%, 0.3)`);
      cGrad.addColorStop(1, `hsla(${280 + coh * 60}, 40%, 30%, 0.05)`);
      ctx.beginPath();
      ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
      ctx.fillStyle = cGrad;
      ctx.fill();

      // Orbiting dots based on coherence
      const dotCount = Math.floor(4 + coh * 12);
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2 + t * 0.5;
        const orbitR = maxR * 0.7 + Math.sin(t + i * 2) * 10;
        const dx = cx + Math.cos(angle) * orbitR;
        const dy = cy + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5 + coh, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${280 + i * 20 + coh * 40}, 70%, 70%, ${0.4 + coh * 0.4})`;
        ctx.fill();
      }
    }

    // ── FOREST THEME ──
    else if (theme === "forest") {
      // Night forest background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#0a1a0a");
      skyGrad.addColorStop(0.6, `rgba(${8 + coh * 15}, ${20 + coh * 30}, ${10 + coh * 15}, 1)`);
      skyGrad.addColorStop(1, "#060d06");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Ground
      ctx.fillStyle = `rgba(${15 + coh * 10}, ${25 + coh * 15}, ${10}, 0.8)`;
      ctx.fillRect(0, height * 0.78, width, height * 0.22);

      // Tree trunk
      const trunkW = 12 + scale * 6;
      const trunkH = height * 0.35;
      const trunkGrad = ctx.createLinearGradient(cx - trunkW, cy, cx + trunkW, cy);
      trunkGrad.addColorStop(0, `rgba(${60 + coh * 30}, ${40 + coh * 15}, ${25}, 0.9)`);
      trunkGrad.addColorStop(0.5, `rgba(${80 + coh * 40}, ${55 + coh * 20}, ${30}, 1)`);
      trunkGrad.addColorStop(1, `rgba(${50 + coh * 20}, ${35 + coh * 10}, ${20}, 0.9)`);
      ctx.fillStyle = trunkGrad;
      ctx.beginPath();
      ctx.moveTo(cx - trunkW * 0.6, height * 0.78);
      ctx.lineTo(cx - trunkW * 0.3, cy + 20);
      ctx.lineTo(cx + trunkW * 0.3, cy + 20);
      ctx.lineTo(cx + trunkW * 0.6, height * 0.78);
      ctx.fill();

      // Sap flow (inspiration = sap rises)
      if (phase === "inhale" || phase === "hold") {
        const sapY = height * 0.78 - trunkH * progress * (phase === "hold" ? 1 : 1);
        const sapGrad = ctx.createLinearGradient(0, height * 0.78, 0, sapY);
        sapGrad.addColorStop(0, "transparent");
        sapGrad.addColorStop(1, `rgba(${80 + coh * 120}, ${200 + coh * 55}, ${60}, ${0.15 + coh * 0.2})`);
        ctx.fillStyle = sapGrad;
        ctx.fillRect(cx - trunkW * 0.2, sapY, trunkW * 0.4, height * 0.78 - sapY);
      }

      // Canopy (branches + leaves)
      const canopyLayers = 4 + Math.floor(coh * 3);
      for (let i = 0; i < canopyLayers; i++) {
        const layerY = cy - 10 - i * 18 * scale;
        const layerW = (50 + i * 8) * scale * (0.7 + coh * 0.3);
        const sway = Math.sin(t * 0.8 + i * 0.7) * 5 * (1 - coh * 0.3);
        ctx.beginPath();
        ctx.ellipse(cx + sway, layerY, layerW, 14 * scale, 0, 0, Math.PI * 2);
        const leafHue = 100 + coh * 40 + i * 8;
        const leafLight = 20 + coh * 25 + i * 3;
        ctx.fillStyle = `hsla(${leafHue}, ${40 + coh * 25}%, ${leafLight}%, ${0.3 + coh * 0.15})`;
        ctx.fill();
      }

      // Flowers bloom with high coherence
      if (coh > 0.5) {
        const flowerCount = Math.floor((coh - 0.5) * 16);
        for (let i = 0; i < flowerCount; i++) {
          const a = (i / flowerCount) * Math.PI * 2 + t * 0.1;
          const r = 30 + Math.sin(i * 3.7) * 25;
          const fx = cx + Math.cos(a) * r * scale;
          const fy = cy - 20 + Math.sin(a) * r * 0.5 * scale;
          const fs = 2 + coh * 3;
          ctx.beginPath();
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * Math.PI * 2 + t * 0.3;
            ctx.ellipse(fx + Math.cos(pa) * fs, fy + Math.sin(pa) * fs, fs * 0.6, fs * 0.3, pa, 0, Math.PI * 2);
          }
          ctx.fillStyle = `hsla(${330 + i * 30}, 70%, ${60 + coh * 20}%, ${0.4 + coh * 0.3})`;
          ctx.fill();
        }
      }

      // Fireflies
      if (particlesRef.current.length < 20) {
        particlesRef.current.push({
          x: Math.random() * width, y: height * 0.3 + Math.random() * height * 0.5,
          vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2,
          r: 1.5 + Math.random(), life: 1, blink: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx + Math.sin(t + p.blink) * 0.3;
        p.y += p.vy + Math.cos(t * 0.7 + p.blink) * 0.2;
        p.life -= 0.003;
        if (p.life <= 0 || p.x < 0 || p.x > width) return false;
        const glow = (Math.sin(t * 3 + p.blink) * 0.5 + 0.5) * coh;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + glow * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${200 + coh * 55}, ${230 + coh * 25}, ${100}, ${p.life * glow * 0.8})`;
        ctx.fill();
        // Glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + coh * 55}, ${220}, ${80}, ${p.life * glow * 0.08})`;
        ctx.fill();
        return true;
      });
    }

    // ── COSMOS THEME ──
    else if (theme === "cosmos") {
      // Deep space
      ctx.fillStyle = "#020208";
      ctx.fillRect(0, 0, width, height);

      // Distant stars (static layer)
      for (let i = 0; i < 50; i++) {
        const sx = (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 * width;
        const sy = (Math.sin(i * 269.5 + 183.3) * 43758.5453) % 1 * height;
        const sb = 0.2 + Math.sin(t * 1.5 + i * 0.8) * 0.2;
        ctx.beginPath();
        ctx.arc(Math.abs(sx), Math.abs(sy), 0.5 + Math.sin(i) * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${sb})`;
        ctx.fill();
      }

      // Nebula clouds (2-3 layers)
      for (let n = 0; n < 3; n++) {
        const nCx = cx + Math.sin(t * 0.1 + n * 2) * 30;
        const nCy = cy + Math.cos(t * 0.08 + n * 1.5) * 20;
        const nR = 80 + n * 30 + scale * 40;
        const nebGrad = ctx.createRadialGradient(nCx, nCy, 0, nCx, nCy, nR);
        const hue = 240 + coh * 80 + n * 40;
        nebGrad.addColorStop(0, `hsla(${hue}, 60%, ${30 + coh * 20}%, ${0.1 + coh * 0.08})`);
        nebGrad.addColorStop(0.5, `hsla(${hue + 20}, 50%, ${20 + coh * 15}%, ${0.05 + coh * 0.04})`);
        nebGrad.addColorStop(1, "transparent");
        ctx.fillStyle = nebGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Spiral galaxy (builds with coherence)
      const arms = 2 + Math.floor(coh * 2);
      const spiralStars = Math.floor(20 + coh * 60);
      for (let arm = 0; arm < arms; arm++) {
        const armOffset = (arm / arms) * Math.PI * 2;
        for (let i = 0; i < spiralStars / arms; i++) {
          const dist = (i / (spiralStars / arms)) * 100 * scale;
          const angle = armOffset + dist * 0.04 + t * 0.15;
          const spread = (1 - coh * 0.5) * 12;
          const sx = cx + Math.cos(angle) * dist + (Math.sin(i * 7.3) * spread);
          const sy = cy + Math.sin(angle) * dist * 0.6 + (Math.cos(i * 5.1) * spread * 0.6);
          const brightness = 0.3 + coh * 0.5 - (dist / (100 * scale)) * 0.2;
          const starR = 0.8 + coh * 1.2 - dist * 0.005;
          if (starR > 0 && brightness > 0) {
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0.3, starR), 0, Math.PI * 2);
            const starHue = 200 + coh * 60 + dist * 0.5;
            ctx.fillStyle = `hsla(${starHue}, ${50 + coh * 30}%, ${70 + coh * 20}%, ${Math.max(0, brightness)})`;
            ctx.fill();
          }
        }
      }

      // Central star / black hole
      const coreR = scale * 20 + coh * 15;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, `rgba(255, ${220 + coh * 35}, ${180 + coh * 75}, 0.9)`);
      coreGrad.addColorStop(0.3, `rgba(200, ${150 + coh * 80}, ${100 + coh * 100}, 0.4)`);
      coreGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Zoom effect tied to breathing
      if (phase === "inhale") {
        // Stars stretch slightly outward
        ctx.globalAlpha = 0.03 * progress;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const d = 100 + progress * 40;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
          ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
          ctx.strokeStyle = "rgba(200, 220, 255, 1)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── MINIMAL THEME ──
    else if (theme === "minimal") {
      // Clean dark background
      ctx.fillStyle = "#0a0a0e";
      ctx.fillRect(0, 0, width, height);

      // Morphing shape: circle → rounded square → diamond based on cycle
      const cyclePhase = (phase === "inhale" ? progress : phase === "exhale" ? 1 - progress : phase === "hold" ? 1 : 0);
      const shapeR = 40 + scale * 50;

      // Trace history (ghost shapes from previous cycles)
      const traceCount = Math.floor(3 + coh * 5);
      for (let tr = traceCount; tr >= 0; tr--) {
        const trAlpha = (1 - tr / (traceCount + 1)) * 0.06 * (1 + coh);
        const trR = shapeR - tr * 4;
        const trRot = t * 0.3 - tr * 0.15;
        if (trR <= 0) continue;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(trRot);

        // Superellipse (morphs between circle and square)
        const n = 2 + cyclePhase * 2; // 2 = circle, 4 = squarish
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.05) {
          const cosA = Math.cos(a), sinA = Math.sin(a);
          const x = Math.sign(cosA) * Math.pow(Math.abs(cosA), 2 / n) * trR;
          const y = Math.sign(sinA) * Math.pow(Math.abs(sinA), 2 / n) * trR;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${180 + coh * 75}, ${180 + coh * 75}, ${200 + coh * 55}, ${trAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Main shape
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      const nMain = 2 + cyclePhase * 2;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.03) {
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const x = Math.sign(cosA) * Math.pow(Math.abs(cosA), 2 / nMain) * shapeR;
        const y = Math.sign(sinA) * Math.pow(Math.abs(sinA), 2 / nMain) * shapeR;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      const mainColor = `rgba(${180 + coh * 75}, ${180 + coh * 75}, ${200 + coh * 55}, ${0.4 + coh * 0.4})`;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.5 + coh;
      ctx.stroke();
      // Subtle fill
      ctx.fillStyle = `rgba(${150 + coh * 60}, ${150 + coh * 60}, ${180 + coh * 40}, ${0.02 + coh * 0.04})`;
      ctx.fill();
      ctx.restore();

      // Corner dots (breathing rhythm markers)
      const dotR = 3 + coh * 2;
      const corners = 4;
      for (let i = 0; i < corners; i++) {
        const a = (i / corners) * Math.PI * 2 + t * 0.3;
        const d = shapeR + 20;
        const dx = cx + Math.cos(a) * d;
        const dy = cy + Math.sin(a) * d;
        ctx.beginPath();
        ctx.arc(dx, dy, dotR * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${180 + coh * 75}, ${180 + coh * 75}, ${200 + coh * 55}, ${0.3 + coh * 0.4})`;
        ctx.fill();
      }

      // Pulse ring
      const pulseR = shapeR + 30 + Math.sin(t * 2) * 5;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${180 + coh * 75}, ${180 + coh * 75}, ${200 + coh * 55}, ${0.06 + coh * 0.06})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── LABEL overlay ──
    ctx.save();
    ctx.font = `700 14px ${T.fontMono.replace(/'/g, "")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + scale * 0.3})`;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.fillText(label, cx, cy);
    ctx.restore();

    // ── Coherence ring (all themes) ──
    const ringR = Math.min(width, height) / 2 - 8;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,0.06)`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (coherenceScore !== null) {
      const cohAngle = (coherenceScore / 100) * Math.PI * 2;
      const cohC = coherenceScore > 60 ? T.good : coherenceScore > 30 ? T.warn : T.bad;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + cohAngle);
      ctx.strokeStyle = cohC;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

  }, [phase, progress, label, coherenceScore, theme, width, height, coh, audioEnabled]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, borderRadius: "16px" }} />;
}

// Legacy BreathingOrb wrapper for resonance search (simpler visual)
function BreathingOrb({ phase, progress, label, coherenceScore, audioEnabled }) {
  return <BreathingVisual phase={phase} progress={progress} label={label} coherenceScore={coherenceScore} audioEnabled={audioEnabled} theme="ocean" width={260} height={260} />;
}

// ─── RR CHART ────────────────────────────────────────────────
function RRChart({ data, width = 600, height = 120 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || data.length < 2) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const f = HRV.filterArtifacts(data).slice(-200);
    if (f.length < 2) return;
    const min = Math.min(...f)-30, max = Math.max(...f)+30, range = max-min||1;
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    for (let i=0;i<4;i++) { ctx.beginPath(); ctx.moveTo(0,(height/4)*i); ctx.lineTo(width,(height/4)*i); ctx.stroke(); }
    ctx.beginPath(); ctx.strokeStyle = `${T.accent}cc`; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
    f.forEach((v,i) => {
      const x = (i/(f.length-1))*width, y = height-((v-min)/range)*(height-16)-8;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    const g = ctx.createLinearGradient(0,0,0,height);
    g.addColorStop(0, `${T.accent}20`); g.addColorStop(1, `${T.accent}00`);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fillStyle = g; ctx.fill();
  }, [data, width, height]);
  return <canvas ref={ref} style={{ width: `${width}px`, height: `${height}px`, borderRadius: "8px" }} />;
}

// ─── COHERENCE GAUGE ─────────────────────────────────────────
function CoherenceGauge({ value }) {
  const v = value !== null ? Math.round(value) : 0;
  const c = v > 60 ? T.good : v > 30 ? T.warn : T.bad;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", background: T.bgCard, borderRadius: "10px" }}>
      <div style={{ fontFamily: T.fontBody, fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>Cohérence</div>
      <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: c, borderRadius: "3px", transition: "width 0.5s ease, background 0.3s" }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: "14px", color: c, fontWeight: 700, minWidth: "40px", textAlign: "right" }}>{v}%</div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────
export default function VitalCoach() {
  // --- APP STATE ---
  const [view, setView] = useState("home");
  const [clients, setClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [sessions, setSessions] = useState([]); // { clientId, date, program, pre, post, preQ, postQ, notes }

  // --- BLE ---
  const [bleStatus, setBleStatus] = useState("off");
  const [deviceName, setDeviceName] = useState("");
  const [battery, setBattery] = useState(null);
  const [currentHR, setCurrentHR] = useState(0);
  const bleCharRef = useRef(null);
  const bleDeviceRef = useRef(null);

  // --- SESSION ---
  const [sessionPhase, setSessionPhase] = useState("idle"); // idle, preQ, preMeasure, preResults, exercise, postMeasure, postQ, notes, results
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [rrData, setRrData] = useState([]);
  const [measureTime, setMeasureTime] = useState(0);
  const [measureStart, setMeasureStart] = useState(null);
  const [preMetrics, setPreMetrics] = useState(null);
  const [postMetrics, setPostMetrics] = useState(null);
  const [preReliability, setPreReliability] = useState(null);
  const [postReliability, setPostReliability] = useState(null);
  const [preDiag, setPreDiag] = useState(null);
  const [postDiag, setPostDiag] = useState(null);
  const [breathProtocol, setBreathProtocol] = useState("coherence55");
  const [breathDuration, setBreathDuration] = useState(300);
  const [breathActive, setBreathActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [visualTheme, setVisualTheme] = useState("ocean");
  const [coachNotes, setCoachNotes] = useState("");

  // --- QUESTIONNAIRES ---
  const [preQ, setPreQ] = useState({ wellbeing: 3, stress: 3, sleep: 3, energy: 3, position: "seated", note: "" });
  const [postQ, setPostQ] = useState({ wellbeing: 3, stress: 3, difficulty: 2, feltChange: 2, note: "" });

  // --- BREATHING ---
  const [breathPhase, setBreathPhase] = useState("idle");
  const [breathProgress, setBreathProgress] = useState(0);
  const [breathLabel, setBreathLabel] = useState("PRÊT");
  const [breathElapsed, setBreathElapsed] = useState(0);
  const [breathCycles, setBreathCycles] = useState(0);
  const [liveCoherence, setLiveCoherence] = useState(null);
  const breathRef = useRef(null);
  const breathStartRef = useRef(null);

  // --- RESONANCE SEARCH ---
  const [resonancePhase, setResonancePhase] = useState(0); // 0-4 = testing freqs
  const [resonanceResults, setResonanceResults] = useState([]);
  const [resonanceActive, setResonanceActive] = useState(false);
  const [resonanceRR, setResonanceRR] = useState([]);
  const [resonanceTimer, setResonanceTimer] = useState(0);
  const resonanceTimerRef = useRef(null);
  const resonanceFreqs = [6.5, 6.0, 5.5, 5.0, 4.5]; // breaths/min
  const RESONANCE_STEP_DURATION = 120; // 2 min per step

  // --- CLIENT FORM ---
  const [clientForm, setClientForm] = useState({ pseudo: "", age: 35, sex: "M", weight: 75, height: 175, activity: "moderate", smoker: false, medication: "", objectives: ["stress"], context: [], consent: false });

  // --- DEMO MODE ---
  const [demoMode, setDemoMode] = useState(false);

  const timerRef = useRef(null);

  // ── BLE PARSING ──
  const parseHR = useCallback((event) => {
    const v = event.target.value;
    const flags = v.getUint8(0);
    const is16 = (flags & 0x01) === 1;
    const hasRR = (flags & 0x10) !== 0;
    let hr, off;
    if (is16) { hr = v.getUint16(1, true); off = 3; }
    else { hr = v.getUint8(1); off = 2; }
    if (flags & 0x08) off += 2;
    setCurrentHR(hr);
    if (hasRR) {
      const newRR = [];
      while (off + 1 < v.byteLength) {
        newRR.push((v.getUint16(off, true) / 1024) * 1000);
        off += 2;
      }
      if (newRR.length > 0) setRrData(p => [...p, ...newRR]);
    }
  }, []);

  const connectBLE = async () => {
    try {
      setBleStatus("connecting");
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }], optionalServices: ["battery_service"] });
      bleDeviceRef.current = dev;
      setDeviceName(dev.name || "Capteur BLE");
      dev.addEventListener("gattserverdisconnected", () => {
        setBleStatus("off"); setDeviceName(""); setBattery(null);
        bleCharRef.current = null;
      });
      const server = await dev.gatt.connect();
      const hrSvc = await server.getPrimaryService("heart_rate");
      const hrC = await hrSvc.getCharacteristic("heart_rate_measurement");
      hrC.addEventListener("characteristicvaluechanged", parseHR);
      await hrC.startNotifications();
      bleCharRef.current = hrC;
      try { const bs = await server.getPrimaryService("battery_service"); const bc = await bs.getCharacteristic("battery_level"); const bv = await bc.readValue(); setBattery(bv.getUint8(0)); } catch {}
      setBleStatus("on");
    } catch (err) {
      console.error("BLE connect error:", err);
      setBleStatus("off");
    }
  };

  // Reconnect if device was paired but disconnected
  const reconnectBLE = async () => {
    if (!bleDeviceRef.current?.gatt) return false;
    try {
      setBleStatus("connecting");
      const server = await bleDeviceRef.current.gatt.connect();
      const hrSvc = await server.getPrimaryService("heart_rate");
      const hrC = await hrSvc.getCharacteristic("heart_rate_measurement");
      hrC.addEventListener("characteristicvaluechanged", parseHR);
      await hrC.startNotifications();
      bleCharRef.current = hrC;
      setBleStatus("on");
      return true;
    } catch {
      setBleStatus("off");
      return false;
    }
  };

  // ── DEMO DATA ──
  const generateDemoRR = (baseRMSSD = 22, count = 200) => {
    const rr = [];
    let last = 850;
    for (let i = 0; i < count; i++) {
      const variation = (Math.random() - 0.5) * baseRMSSD * 2;
      last = Math.max(550, Math.min(1200, last + variation));
      rr.push(last);
    }
    return rr;
  };

  // ── MEASUREMENT ──
  const [bleWarning, setBleWarning] = useState("");

  const startMeasure = async () => {
    setBleWarning("");
    // Check if BLE is still connected, try reconnect if needed
    if (!demoMode && bleStatus !== "on") {
      const reconnected = await reconnectBLE();
      if (!reconnected) {
        setBleWarning("Connexion perdue. Vérifiez que la ceinture est portée et humidifiée, puis reconnectez.");
        return;
      }
    }
    setRrData([]);
    setIsRecording(true);
    setMeasureStart(Date.now());
    setMeasureTime(0);
    timerRef.current = setInterval(() => setMeasureTime(p => p + 1), 1000);
  };

  const stopMeasure = (phase) => {
    setIsRecording(false);
    clearInterval(timerRef.current);
    const dur = Date.now() - measureStart;
    const data = demoMode && rrData.length < 10 ? generateDemoRR(phase === "post" ? 32 : 22) : rrData;
    const m = HRV.allMetrics(data);
    const r = HRV.reliability(data, dur || 180000);
    const d = HRV.generateDiagnostic(m, r, activeClient);
    if (phase === "pre") {
      setPreMetrics(m); setPreReliability(r); setPreDiag(d);
      let reco = d.recommendedProtocol;
      // If client has custom resonance and resonance-type is recommended, use custom
      if (activeClient?.resonanceFreq && (reco.protocol === "resonance" || reco.protocol === "coherence55")) {
        if (reco.protocol === "resonance") {
          reco = { ...reco, protocol: "resonanceCustom" };
        }
      }
      setBreathProtocol(reco.protocol);
      setBreathDuration(reco.duration);
      setSessionPhase("preResults");
    } else {
      setPostMetrics(m); setPostReliability(r); setPostDiag(d);
      setSessionPhase("postQ");
    }
  };

  // ── BREATHING ──
  const startBreathing = () => {
    const p = PROTOCOLS[breathProtocol] || PROTOCOLS.coherence55;
    const cycleDur = p.inhale + p.hold + p.exhale + p.holdOut;
    setBreathActive(true);
    if (audioEnabled) { AudioEngine.startBreathTone(); AudioEngine.startBgSound(); }
    breathStartRef.current = performance.now();
    
    const tick = (now) => {
      const elapsed = (now - breathStartRef.current) / 1000;
      setBreathElapsed(elapsed);
      if (elapsed >= breathDuration) {
        setBreathActive(false);
        AudioEngine.stop();
        setSessionPhase("postMeasure");
        return;
      }
      const ct = elapsed % cycleDur;
      setBreathCycles(Math.floor(elapsed / cycleDur));
      if (ct < p.inhale) { setBreathPhase("inhale"); setBreathProgress(ct / p.inhale); setBreathLabel("INSPIREZ"); }
      else if (ct < p.inhale + p.hold) { setBreathPhase("hold"); setBreathProgress((ct-p.inhale)/p.hold); setBreathLabel("RETENEZ"); }
      else if (ct < p.inhale + p.hold + p.exhale) { setBreathPhase("exhale"); setBreathProgress((ct-p.inhale-p.hold)/p.exhale); setBreathLabel("EXPIREZ"); }
      else { setBreathPhase("holdOut"); setBreathProgress((ct-p.inhale-p.hold-p.exhale)/p.holdOut); setBreathLabel("PAUSE"); }

      // Live coherence from recent RR
      if (rrData.length > 20) setLiveCoherence(HRV.coherence(rrData.slice(-60)));
      breathRef.current = requestAnimationFrame(tick);
    };
    breathRef.current = requestAnimationFrame(tick);
  };

  const stopBreathing = () => {
    setBreathActive(false);
    AudioEngine.stop();
    if (breathRef.current) cancelAnimationFrame(breathRef.current);
    setSessionPhase("postMeasure");
  };

  // ── SAVE SESSION ──
  const saveSession = () => {
    const hour = new Date().getHours();
    const s = {
      id: Date.now(),
      clientId: activeClient?.id || "demo",
      date: new Date().toISOString(),
      timeContext: HRV.getTimeContext(hour),
      position: preQ.position || "seated",
      program: selectedProgram,
      preMetrics, postMetrics, preReliability, postReliability,
      preQ, postQ, notes: coachNotes,
      protocol: breathProtocol, breathDuration,
    };
    setSessions(p => [...p, s]);
    setSessionPhase("results");
  };

  // ── RESONANCE SEARCH ──
  const startResonanceStep = (step) => {
    setResonancePhase(step);
    setResonanceRR([]);
    setResonanceTimer(0);
    setResonanceActive(true);
    setRrData([]);
    // Start collecting RR for this frequency
    resonanceTimerRef.current = setInterval(() => {
      setResonanceTimer(p => {
        if (p + 1 >= RESONANCE_STEP_DURATION) {
          clearInterval(resonanceTimerRef.current);
          // Calculate ALL metrics for this step (composite scoring)
          const data = demoMode ? generateDemoRR(18 + (step === 2 ? 12 : step === 1 ? 6 : step === 3 ? 8 : Math.random() * 5), 120) : rrData;
          const stepMetrics = {
            freq: resonanceFreqs[step],
            breathsPerMin: resonanceFreqs[step],
            cycleDuration: 60 / resonanceFreqs[step],
            rmssd: HRV.rmssd(data),
            sdnn: HRV.sdnn(data),
            coherence: HRV.coherence(data) || 0,
            dfa1: HRV.dfaAlpha1(data),
            poincareSd1: HRV.poincare(data)?.sd1 || 0,
            respiratoryRate: HRV.respiratoryRate(data),
            // Validation: is the client breathing at the right rate?
            breathingValid: (() => {
              const estRate = HRV.respiratoryRate(data);
              if (estRate === null) return null;
              const targetRate = resonanceFreqs[step];
              return Math.abs(estRate - targetRate) < targetRate * 0.25; // within 25%
            })(),
          };
          setResonanceResults(prev => [...prev, stepMetrics]);
          // Auto-advance or finish
          if (step < 4) {
            setTimeout(() => startResonanceStep(step + 1), 1500);
          } else {
            setResonanceActive(false);
          }
          return 0;
        }
        return p + 1;
      });
    }, 1000);
  };

  // Composite resonance scoring
  const computeResonanceScores = (results) => {
    if (results.length < 2) return results.map(r => ({ ...r, compositeScore: 0, confidence: 0 }));
    // Normalize each metric to 0-1 relative to max in the set
    const maxRmssd = Math.max(...results.map(r => r.rmssd)) || 1;
    const maxSdnn = Math.max(...results.map(r => r.sdnn)) || 1;
    const maxCoherence = Math.max(...results.map(r => r.coherence)) || 1;
    const maxSd1 = Math.max(...results.map(r => r.poincareSd1)) || 1;
    // DFA α1: best when closest to 1.0
    const dfaScores = results.map(r => r.dfa1 !== null ? 1 - Math.abs(r.dfa1 - 1.0) : 0);
    const maxDfa = Math.max(...dfaScores) || 1;

    const scored = results.map((r, i) => {
      const nRmssd = r.rmssd / maxRmssd;
      const nSdnn = r.sdnn / maxSdnn;
      const nCoherence = r.coherence / maxCoherence;
      const nDfa = dfaScores[i] / maxDfa;
      const nSd1 = r.poincareSd1 / maxSd1;
      // Breathing validation penalty
      const validPenalty = r.breathingValid === false ? 0.7 : 1.0;
      // Weighted composite
      const composite = (
        nRmssd * 0.25 +
        nSdnn * 0.15 +
        nCoherence * 0.25 +
        nDfa * 0.15 +
        nSd1 * 0.10 +
        (r.breathingValid !== false ? 0.10 : 0)
      ) * validPenalty;
      return { ...r, compositeScore: composite, nRmssd, nSdnn, nCoherence, nDfa, nSd1 };
    });

    // Confidence: how much do all metrics agree on the best?
    const bestIdx = scored.reduce((bi, s, i) => s.compositeScore > scored[bi].compositeScore ? i : bi, 0);
    const sortedScores = scored.map(s => s.compositeScore).sort((a, b) => b - a);
    const gap = sortedScores.length > 1 ? (sortedScores[0] - sortedScores[1]) / sortedScores[0] : 0;
    // Count how many individual metrics point to the same best
    const metricsAgreeing = [
      scored[bestIdx].nRmssd === 1,
      scored[bestIdx].nSdnn === 1,
      scored[bestIdx].nCoherence === 1,
      scored[bestIdx].nDfa >= 0.9,
      scored[bestIdx].nSd1 === 1,
    ].filter(Boolean).length;
    const confidence = Math.min(98, Math.round(60 + gap * 20 + metricsAgreeing * 6));

    return scored.map((s, i) => ({ ...s, isBest: i === bestIdx, confidence: i === bestIdx ? confidence : 0 }));
  };

  const finishResonance = () => {
    if (resonanceResults.length === 0) return;
    const scored = computeResonanceScores(resonanceResults);
    const best = scored.find(s => s.isBest);
    if (!best) return;
    const halfCycle = best.cycleDuration / 2;
    const updatedClient = {
      ...activeClient,
      resonanceFreq: best.breathsPerMin,
      resonanceCycle: best.cycleDuration,
      resonanceConfidence: best.confidence,
    };
    setActiveClient(updatedClient);
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    PROTOCOLS.resonanceCustom.inhale = halfCycle;
    PROTOCOLS.resonanceCustom.exhale = halfCycle;
    PROTOCOLS.resonanceCustom.desc = `${best.breathsPerMin} resp/min — Personnalisé`;
    PROTOCOLS.resonanceCustom.name = `Résonance ${best.breathsPerMin}/min`;
    setView("home");
  };

  const cancelResonance = () => {
    clearInterval(resonanceTimerRef.current);
    setResonanceActive(false);
    setResonancePhase(0);
    setResonanceResults([]);
    setView("home");
  };

  // ── PDF GENERATION ──
  const generatePDF = () => {
    const client = activeClient || { name: "Client", age: "—", sex: "—", bmi: "—" };
    const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const prog = selectedProgram ? PROGRAMS[selectedProgram] : null;
    const proto = PROTOCOLS[breathProtocol];

    const metricLine = (label, pre, post, unit, higherBetter) => {
      if (pre === null || pre === undefined) return "";
      const preStr = typeof pre === "number" ? pre.toFixed(1) : pre;
      const postStr = post !== null && post !== undefined ? (typeof post === "number" ? post.toFixed(1) : post) : "—";
      let delta = "";
      if (post !== null && post !== undefined && typeof pre === "number" && typeof post === "number" && pre !== 0) {
        const d = ((post - pre) / pre) * 100;
        delta = ` (${d > 0 ? "+" : ""}${d.toFixed(1)}%)`;
      }
      return `${label}: ${preStr} → ${postStr} ${unit}${delta}`;
    };

    const emojiToText = (v) => ["Très mal", "Mal", "Moyen", "Bien", "Très bien"][v - 1] || "—";
    const diffText = ["", "Facile", "Confortable", "Difficile", "Trop difficile"];
    const changeText = ["", "Oui, nettement", "Un peu", "Pas vraiment", "Moins bien"];

    const lines = [
      "═══════════════════════════════════════════",
      "           VITALCOACH — RAPPORT DE SÉANCE",
      "═══════════════════════════════════════════",
      "",
      `Client : ${client.pseudo}`,
      `Profil : ${client.sex === "F" ? "Femme" : "Homme"}, ${client.age} ans, IMC ${client.bmi}`,
      `Date   : ${date}`,
      prog ? `Programme : ${prog.icon} ${prog.name} (${prog.duration})` : "",
      `Protocole : ${proto?.name || "—"}`,
      "",
      "───────────────────────────────────────────",
      "  RESSENTI CLIENT",
      "───────────────────────────────────────────",
      `Bien-être  : ${emojiToText(preQ.wellbeing)} → ${emojiToText(postQ.wellbeing)}`,
      `Stress     : ${emojiToText(preQ.stress)} → ${emojiToText(postQ.stress)}`,
      `Sommeil    : ${emojiToText(preQ.sleep)}`,
      `Énergie    : ${emojiToText(preQ.energy)}`,
      `Difficulté exercice : ${diffText[postQ.difficulty] || "—"}`,
      `Changement ressenti : ${changeText[postQ.feltChange] || "—"}`,
      preQ.note ? `Note arrivée : ${preQ.note}` : "",
      "",
      "───────────────────────────────────────────",
      "  MÉTRIQUES PHYSIOLOGIQUES (Avant → Après)",
      "───────────────────────────────────────────",
      preMetrics ? metricLine("RMSSD       ", preMetrics.rmssd, postMetrics?.rmssd, "ms", true) : "",
      preMetrics ? metricLine("SDNN        ", preMetrics.sdnn, postMetrics?.sdnn, "ms", true) : "",
      preMetrics ? metricLine("pNN50       ", preMetrics.pnn50, postMetrics?.pnn50, "%", true) : "",
      preMetrics ? metricLine("FC moyenne  ", preMetrics.meanHR, postMetrics?.meanHR, "bpm", false) : "",
      preMetrics ? metricLine("Stress Index", preMetrics.stressIndex, postMetrics?.stressIndex, "", false) : "",
      preMetrics ? metricLine("LF/HF       ", preMetrics.lfhf, postMetrics?.lfhf, "", false) : "",
      preMetrics ? metricLine("Cohérence   ", preMetrics.coherence, postMetrics?.coherence, "%", true) : "",
      "",
      `Fiabilité pré  : ${preReliability || "—"}%`,
      `Fiabilité post : ${postReliability || "—"}%`,
      "",
      "───────────────────────────────────────────",
      "  AIDE À LA DÉCISION",
      "───────────────────────────────────────────",
      (() => {
        if (!preMetrics || !postMetrics) return "Mesure post non réalisée.";
        const d = ((postMetrics.rmssd - preMetrics.rmssd) / preMetrics.rmssd) * 100;
        if (d > 15) return "✅ Réponse positive significative. Poursuite recommandée.";
        if (d > 5) return "⚡ Amélioration modérée. Ajuster protocole ou durée.";
        return "📋 Réponse limitée. Envisager autre approche.";
      })(),
      "",
      coachNotes ? "───────────────────────────────────────────" : "",
      coachNotes ? "  NOTES DU COACH" : "",
      coachNotes ? "───────────────────────────────────────────" : "",
      coachNotes || "",
      "",
      "═══════════════════════════════════════════",
      "AVERTISSEMENT : Ce rapport ne constitue pas",
      "un diagnostic médical. Il ne se substitue",
      "pas à l'avis d'un professionnel de santé.",
      "═══════════════════════════════════════════",
      "",
      "Généré par VitalCoach — " + new Date().toLocaleString("fr-FR"),
    ].filter(l => l !== "").join("\n");

    // Generate downloadable text file (PDF would require a library)
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VitalCoach_${client.pseudo.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── RESET ──
  const resetSession = () => {
    setSessionPhase("idle"); setPreMetrics(null); setPostMetrics(null);
    setPreReliability(null); setPostReliability(null); setPreDiag(null); setPostDiag(null);
    setRrData([]); setBreathActive(false); setCoachNotes(""); setBleWarning("");
    setPreQ({ wellbeing: 3, stress: 3, sleep: 3, energy: 3, position: "seated", note: "" });
    setPostQ({ wellbeing: 3, stress: 3, difficulty: 2, feltChange: 2, note: "" });
    setLiveCoherence(null);
  };

  // ── CLIENT CRUD ──
  const saveClient = () => {
    const c = { ...clientForm, id: Date.now(), bmi: (clientForm.weight / ((clientForm.height/100)**2)).toFixed(1), createdAt: new Date().toISOString() };
    setClients(p => [...p, c]);
    setActiveClient(c);
    setView("home");
  };

  const clientSessions = useMemo(() =>
    sessions.filter(s => s.clientId === (activeClient?.id || "demo")),
    [sessions, activeClient]
  );

  const bleOk = bleStatus === "on" || demoMode;
  const webBTSupported = typeof navigator !== "undefined" && !!navigator.bluetooth;

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(170deg, ${T.bg} 0%, #0f1623 40%, #0a1018 100%)`, color: T.text, fontFamily: T.fontBody }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <header style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => { setView("home"); resetSession(); }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg, ${T.accent}, #06b6d4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>♥</div>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "15px", letterSpacing: "-0.3px" }}>VitalCoach</div>
            <div style={{ fontSize: "9px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1.5px" }}>HRV Biofeedback</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {demoMode && <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.warn, padding: "2px 8px", background: T.warnBg, borderRadius: "6px" }}>DÉMO</span>}
          {battery !== null && <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: battery > 20 ? T.good : T.bad }}>🔋{battery}%</span>}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "16px", background: bleOk ? `${T.good}10` : T.bgCard, border: `1px solid ${bleOk ? `${T.good}25` : T.border}` }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: bleOk ? T.good : bleStatus === "connecting" ? T.warn : T.bad }} />
            <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.textMuted }}>{bleOk ? (demoMode ? "Démo" : deviceName) : "Déconnecté"}</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 16px" }}>

        {/* ══════════════════════════════════════════════════════
            HOME VIEW
        ══════════════════════════════════════════════════════ */}
        {view === "home" && sessionPhase === "idle" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ fontFamily: T.fontDisplay, fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 6px" }}>
                {activeClient ? `Bonjour, ${activeClient.pseudo.split(" ")[0]}` : "VitalCoach"}
              </h1>
              <p style={{ fontSize: "13px", color: T.textMuted, margin: 0 }}>
                {activeClient ? `${clientSessions.length} séance${clientSessions.length !== 1 ? "s" : ""} enregistrée${clientSessions.length !== 1 ? "s" : ""}` : "Sélectionnez ou créez un profil client"}
              </p>
            </div>

            {/* Active client card */}
            {activeClient && (
              <Card style={{ marginBottom: "16px", border: `1px solid ${T.accent}25` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "16px" }}>{activeClient.pseudo}</div>
                    <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>
                      {activeClient.age} ans • {activeClient.sex === "F" ? "Femme" : "Homme"} • IMC {activeClient.bmi} • {activeClient.activity === "sedentary" ? "Sédentaire" : activeClient.activity === "moderate" ? "Modéré" : "Actif"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Btn variant="ghost" onClick={() => setView("dashboard")} style={{ fontSize: "12px" }}>📊 Historique</Btn>
                    <Btn variant="ghost" onClick={() => setActiveClient(null)} style={{ fontSize: "12px" }}>Changer</Btn>
                  </div>
                </div>

                {/* Resonance: prominent CTA if not done, subtle badge if done */}
                {activeClient.resonanceFreq ? (
                  <div style={{ marginTop: "10px", padding: "8px 14px", borderRadius: "8px", background: `${T.good}08`, border: `1px solid ${T.good}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "12px", color: T.good }}>
                      🎯 Résonance calibrée : {activeClient.resonanceFreq} resp/min ({(60/activeClient.resonanceFreq/2).toFixed(1)}s / {(60/activeClient.resonanceFreq/2).toFixed(1)}s)
                    </div>
                    <Btn variant="ghost" onClick={() => setView("resonance")} style={{ fontSize: "11px", padding: "4px 10px", color: T.textMuted }}>Recalibrer</Btn>
                  </div>
                ) : (
                  <div onClick={() => setView("resonance")}
                    style={{
                      marginTop: "10px", padding: "14px 16px", borderRadius: "10px", cursor: "pointer",
                      background: "linear-gradient(135deg, rgba(77,166,255,0.1), rgba(6,182,212,0.08))",
                      border: `2px solid ${T.accent}40`,
                      transition: "all 0.2s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "10px",
                        background: `linear-gradient(135deg, ${T.accent}, #06b6d4)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "18px", flexShrink: 0,
                      }}>🎯</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "14px", color: T.accent }}>
                          Calibrer la fréquence de résonance
                        </div>
                        <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px", lineHeight: "1.4" }}>
                          Recommandé avant la première séance • 12 min • Personnalise le protocole pour des résultats optimaux
                        </div>
                      </div>
                      <span style={{ color: T.accent, fontSize: "18px" }}>→</span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Client selection */}
            {!activeClient && (
              <div style={{ marginBottom: "20px" }}>
                {clients.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Clients existants</div>
                    {clients.map(c => (
                      <Card key={c.id} onClick={() => setActiveClient(c)} style={{ marginBottom: "6px", cursor: "pointer", padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 500 }}>{c.pseudo}</span>
                          <span style={{ fontSize: "11px", color: T.textMuted }}>{c.age} ans • IMC {c.bmi}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn variant="primary" onClick={() => setView("newClient")} full>Nouveau client</Btn>
                  <Btn variant="secondary" onClick={() => { setDemoMode(true); setActiveClient({ id: "demo", pseudo: "DemoUser", age: 35, sex: "M", weight: 75, height: 175, bmi: "24.5", activity: "moderate" }); }}>
                    Mode démo
                  </Btn>
                </div>
              </div>
            )}

            {/* Connection */}
            {activeClient && !bleOk && (
              <div style={{ marginBottom: "20px" }}>
                {!webBTSupported && (
                  <Card style={{ background: T.badBg, border: `1px solid ${T.bad}20`, marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", color: "#fca5a5" }}>⚠️ Web Bluetooth non supporté. Utilisez Chrome ou Edge.</div>
                  </Card>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn variant="primary" onClick={connectBLE} disabled={!webBTSupported} full>Connecter Polar H10</Btn>
                  <Btn variant="secondary" onClick={() => setDemoMode(true)}>Démo</Btn>
                </div>
              </div>
            )}

            {/* Program selection */}
            {activeClient && bleOk && (
              <div>
                <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Programme de séance</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {Object.entries(PROGRAMS).map(([key, prog]) => (
                    <Card key={key} onClick={() => setSelectedProgram(key)}
                      style={{
                        cursor: "pointer", padding: "14px 16px",
                        border: `2px solid ${selectedProgram === key ? prog.color + "60" : T.border}`,
                        background: selectedProgram === key ? prog.color + "08" : T.bgCard,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "24px" }}>{prog.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "15px" }}>{prog.name} <span style={{ fontFamily: T.fontMono, fontSize: "12px", color: T.textMuted, fontWeight: 400 }}>— {prog.duration}</span></div>
                          <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>{prog.desc}</div>
                        </div>
                        {selectedProgram === key && <span style={{ color: prog.color, fontSize: "18px" }}>✓</span>}
                      </div>
                    </Card>
                  ))}
                </div>
                <Btn variant="success" full disabled={!selectedProgram} onClick={() => setSessionPhase("preQ")}>
                  Démarrer la séance
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            NEW CLIENT VIEW
        ══════════════════════════════════════════════════════ */}
        {view === "newClient" && (
          <div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Nouveau client</h2>
            
            <Card style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Informations personnelles</div>
              <input placeholder="Pseudo du client (ex: Phoenix42)" value={clientForm.pseudo} onChange={e => setClientForm(p=>({...p, pseudo: e.target.value}))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: T.fontBody, fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />
              
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                {["M", "F"].map(s => (
                  <div key={s} onClick={() => setClientForm(p=>({...p, sex: s}))}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", textAlign: "center", cursor: "pointer", fontSize: "13px", fontWeight: 500,
                      background: clientForm.sex === s ? T.accentGlow : T.bgCard, border: `1px solid ${clientForm.sex === s ? T.accent : T.border}`, color: clientForm.sex === s ? T.accent : T.textMuted }}>
                    {s === "M" ? "Homme" : "Femme"}
                  </div>
                ))}
              </div>

              <SliderInput label="Âge" value={clientForm.age} onChange={v => setClientForm(p=>({...p, age: v}))} min={16} max={85} format={v => `${v} ans`} />
              <SliderInput label="Poids" value={clientForm.weight} onChange={v => setClientForm(p=>({...p, weight: v}))} min={40} max={160} format={v => `${v} kg`} />
              <SliderInput label="Taille" value={clientForm.height} onChange={v => setClientForm(p=>({...p, height: v}))} min={140} max={210} format={v => `${v} cm`} />
              
              <div style={{ fontFamily: T.fontMono, fontSize: "12px", color: T.accent, marginBottom: "10px" }}>
                IMC : {(clientForm.weight / ((clientForm.height/100)**2)).toFixed(1)}
              </div>

              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Niveau d'activité</div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                {[["sedentary","Sédentaire"], ["moderate","Modéré"], ["active","Actif"]].map(([k,l]) => (
                  <div key={k} onClick={() => setClientForm(p=>({...p, activity: k}))}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", textAlign: "center", cursor: "pointer", fontSize: "12px",
                      background: clientForm.activity === k ? T.accentGlow : T.bgCard, border: `1px solid ${clientForm.activity === k ? T.accent : T.border}`, color: clientForm.activity === k ? T.accent : T.textMuted }}>
                    {l}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <input type="checkbox" checked={clientForm.smoker} onChange={e => setClientForm(p=>({...p, smoker: e.target.checked}))} style={{ accentColor: T.accent }} />
                <span style={{ fontSize: "13px", color: T.textMuted }}>Fumeur</span>
              </div>
              <input placeholder="Médicaments (bêtabloquants, etc.) — optionnel" value={clientForm.medication} onChange={e => setClientForm(p=>({...p, medication: e.target.value}))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: T.fontBody, fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />

              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Objectifs</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {[["stress","Gestion du stress"], ["weight","Perte de poids"], ["sleep","Sommeil"], ["performance","Performance"]].map(([k,l]) => (
                  <div key={k} onClick={() => setClientForm(p => {
                    const objs = p.objectives.includes(k) ? p.objectives.filter(o=>o!==k) : [...p.objectives, k];
                    return {...p, objectives: objs};
                  })}
                    style={{ padding: "6px 12px", borderRadius: "16px", cursor: "pointer", fontSize: "12px",
                      background: clientForm.objectives.includes(k) ? T.accentGlow : T.bgCard,
                      border: `1px solid ${clientForm.objectives.includes(k) ? T.accent : T.border}`,
                      color: clientForm.objectives.includes(k) ? T.accent : T.textMuted }}>
                    {l}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Contexte clinique (optionnel)</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                {[["covid_long","COVID long"], ["anxiety","Anxiété / TAG"], ["burnout","Burn-out"], ["trauma","Trauma / PTSD"], ["sleep_disorder","Troubles du sommeil"], ["chronic_pain","Douleurs chroniques"], ["depression","Dépression"]].map(([k,l]) => (
                  <div key={k} onClick={() => setClientForm(p => {
                    const ctxs = p.context.includes(k) ? p.context.filter(c=>c!==k) : [...p.context, k];
                    return {...p, context: ctxs};
                  })}
                    style={{ padding: "6px 12px", borderRadius: "16px", cursor: "pointer", fontSize: "12px",
                      background: clientForm.context.includes(k) ? T.warnBg : T.bgCard,
                      border: `1px solid ${clientForm.context.includes(k) ? `${T.warn}40` : T.border}`,
                      color: clientForm.context.includes(k) ? T.warn : T.textMuted }}>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "10px", color: T.textDim, marginBottom: "10px", lineHeight: "1.4" }}>
                Ces informations permettent d'adapter le protocole respiratoire. Elles ne constituent pas un diagnostic et sont déclaratives.
              </div>
            </Card>

            {/* RGPD Consent */}
            <Card style={{ marginBottom: "16px", background: clientForm.consent ? `${T.good}06` : T.warnBg, border: `1px solid ${clientForm.consent ? `${T.good}20` : `${T.warn}20`}` }}>
              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Consentement</div>
              <div style={{ fontSize: "11px", color: T.textMuted, lineHeight: "1.6", marginBottom: "10px" }}>
                J'autorise le traitement de mes données physiologiques (fréquence cardiaque, variabilité cardiaque) et personnelles dans le cadre exclusif de l'accompagnement coaching bien-être proposé par VitalCoach. Ces données ne constituent pas un diagnostic médical et ne se substituent pas à un avis médical professionnel. Conformément au RGPD, je peux demander l'accès, la rectification ou la suppression de mes données à tout moment.
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="checkbox" checked={clientForm.consent} onChange={e => setClientForm(p=>({...p, consent: e.target.checked}))} style={{ accentColor: T.good, width: "18px", height: "18px" }} />
                <span style={{ fontSize: "13px", color: clientForm.consent ? T.good : T.text, fontWeight: 500 }}>J'ai lu et j'accepte</span>
              </label>
            </Card>

            <div style={{ display: "flex", gap: "8px" }}>
              <Btn variant="secondary" onClick={() => setView("home")}>Annuler</Btn>
              <Btn variant="success" full disabled={!clientForm.pseudo || !clientForm.consent} onClick={saveClient}>Créer le profil</Btn>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            PRE-SESSION QUESTIONNAIRE
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "preQ" && (
          <div>
            <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "4px", textAlign: "center" }}>
              {PROGRAMS[selectedProgram]?.icon} {PROGRAMS[selectedProgram]?.name}
            </div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "24px" }}>Comment arrivez-vous ?</h2>

            {[
              { key: "wellbeing", label: "État général" },
              { key: "stress", label: "Niveau de stress" },
              { key: "sleep", label: "Qualité du sommeil (nuit dernière)" },
              { key: "energy", label: "Niveau d'énergie" },
            ].map(q => (
              <Card key={q.key} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "10px", textAlign: "center" }}>{q.label}</div>
                <EmojiScale value={preQ[q.key]} onChange={v => setPreQ(p=>({...p, [q.key]: v}))} />
              </Card>
            ))}

            {/* Position pour la mesure */}
            <Card style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", textAlign: "center" }}>Position pendant la mesure</div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                {[["seated", "🪑 Assis"], ["standing", "🧍 Debout"], ["lying", "🛏️ Couché"]].map(([k, l]) => (
                  <div key={k} onClick={() => setPreQ(p => ({ ...p, position: k }))}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: "8px", textAlign: "center", cursor: "pointer",
                      fontSize: "13px", fontWeight: 500, transition: "all 0.15s",
                      background: preQ.position === k ? T.accentGlow : T.bgCard,
                      border: `1px solid ${preQ.position === k ? T.accent + "40" : T.border}`,
                      color: preQ.position === k ? T.accent : T.textMuted,
                    }}>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "10px", color: T.textDim, textAlign: "center", marginTop: "6px" }}>
                {preQ.position === "lying" ? "Position couchée : RMSSD naturellement plus élevé — l'app en tient compte" :
                 preQ.position === "standing" ? "Position debout : RMSSD naturellement plus bas — stress orthostatique" :
                 "Position assise : position standard de référence"}
              </div>
            </Card>

            <Card style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "6px" }}>Remarque (optionnel)</div>
              <textarea value={preQ.note} onChange={e => setPreQ(p=>({...p, note: e.target.value}))}
                placeholder="Événement particulier, ressenti..."
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: T.fontBody, fontSize: "13px", resize: "vertical", minHeight: "60px", outline: "none", boxSizing: "border-box" }} />
            </Card>

            {bleWarning && (
              <Card style={{ marginBottom: "12px", background: T.badBg, border: `1px solid ${T.bad}25` }}>
                <div style={{ fontSize: "12px", color: "#fca5a5" }}>⚠️ {bleWarning}</div>
              </Card>
            )}

            <Btn variant="primary" full onClick={async () => { await startMeasure(); if (bleWarning) return; setSessionPhase("preMeasure"); }}>
              Lancer la mesure pré-séance
            </Btn>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MEASURE VIEW (pre & post)
        ══════════════════════════════════════════════════════ */}
        {(sessionPhase === "preMeasure" || sessionPhase === "postMeasure") && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "6px" }}>
                {sessionPhase === "preMeasure" ? "MESURE PRÉ-SÉANCE" : "MESURE POST-SÉANCE"}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: T.bad, animation: "pulse 1.5s infinite" }} />
                <span style={{ fontFamily: T.fontMono, fontSize: "12px", color: T.bad }}>ENREGISTREMENT</span>
              </div>
            </div>

            <div style={{ fontFamily: T.fontMono, fontSize: "52px", fontWeight: 700, textAlign: "center", color: T.text, marginBottom: "16px" }}>
              {String(Math.floor(measureTime/60)).padStart(2,"0")}:{String(measureTime%60).padStart(2,"0")}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <Card style={{ flex: 1, padding: "12px" }}><Metric label="FC" value={currentHR || (demoMode ? 68 + Math.floor(Math.random()*8) : 0)} unit="bpm" compact /></Card>
              <Card style={{ flex: 1, padding: "12px" }}><Metric label="RR reçus" value={rrData.length || (demoMode ? measureTime * 1.1 : 0)} compact /></Card>
              <Card style={{ flex: 1, padding: "12px" }}><Metric label="RMSSD" value={rrData.length > 5 ? HRV.rmssd(rrData) : (demoMode ? 22 + Math.random()*5 : null)} unit="ms" compact /></Card>
            </div>

            {(rrData.length > 5 || demoMode) && (
              <div style={{ marginBottom: "16px", borderRadius: "10px", overflow: "hidden", background: "rgba(0,0,0,0.2)" }}>
                <RRChart data={rrData.length > 5 ? rrData : generateDemoRR(22, 50)} width={720} height={100} />
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <Btn variant="danger" onClick={() => stopMeasure(sessionPhase === "preMeasure" ? "pre" : "post")}>
                Arrêter la mesure
              </Btn>
              {measureTime < 180 && (
                <p style={{ fontSize: "11px", color: T.warn, marginTop: "8px" }}>⚠️ {180 - measureTime}s avant durée minimum</p>
              )}
              {!demoMode && measureTime > 10 && rrData.length === 0 && (
                <Card style={{ marginTop: "12px", background: T.badBg, border: `1px solid ${T.bad}25`, textAlign: "left" }}>
                  <div style={{ fontSize: "12px", color: "#fca5a5", marginBottom: "8px" }}>
                    ⚠️ Aucune donnée reçue après {measureTime}s — la ceinture semble déconnectée
                  </div>
                  <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "8px", lineHeight: "1.5" }}>
                    Vérifiez que la ceinture est bien en contact avec la peau et humidifiée. Essayez de la retirer et la remettre.
                  </div>
                  <Btn variant="secondary" onClick={async () => {
                    clearInterval(timerRef.current);
                    setIsRecording(false);
                    const ok = await reconnectBLE();
                    if (ok) { startMeasure(); setSessionPhase(sessionPhase); }
                  }} style={{ fontSize: "12px" }}>
                    🔄 Reconnecter et relancer
                  </Btn>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            PRE RESULTS + EXERCISE SELECTION
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "preResults" && preDiag && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <h2 style={{ fontFamily: T.fontDisplay, fontSize: "18px", fontWeight: 700, margin: "0 0 6px" }}>Bilan pré-séance</h2>
              <ReliabilityBadge score={preReliability} />
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              {preMetrics && [
                { l: "RMSSD", v: preMetrics.rmssd, u: "ms", s: activeClient ? getSeverityForNorms(preMetrics.rmssd, getNorms(activeClient.sex, activeClient.age), "rmssd") : "neutral" },
                { l: "SDNN", v: preMetrics.sdnn, u: "ms" },
                { l: "FC moy.", v: preMetrics.meanHR, u: "bpm", s: preMetrics.meanHR < 65 ? "good" : preMetrics.meanHR > 85 ? "warn" : "neutral" },
                { l: "LF/HF", v: preMetrics.lfhf, u: "" },
              ].map((m,i) => <Card key={i} style={{ flex: 1, minWidth: "140px", padding: "12px" }}><Metric label={m.l} value={m.v} unit={m.u} severity={m.s} /></Card>)}
            </div>

            {/* New advanced metrics row */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              {preMetrics && [
                { l: "Resp. est.", v: preMetrics.respiratoryRate, u: "/min", s: preMetrics.respiratoryRate !== null ? (preMetrics.respiratoryRate >= 12 && preMetrics.respiratoryRate <= 20 ? "good" : "warn") : "neutral" },
                { l: "Entropie", v: preMetrics.sampleEntropy, u: "", s: preMetrics.sampleEntropy !== null ? (preMetrics.sampleEntropy > 1.5 ? "good" : preMetrics.sampleEntropy > 0.8 ? "neutral" : "warn") : "neutral" },
                { l: "DFA α1", v: preMetrics.dfa1, u: "", s: preMetrics.dfa1 !== null ? (preMetrics.dfa1 >= 0.75 && preMetrics.dfa1 <= 1.0 ? "good" : preMetrics.dfa1 < 0.75 ? "warn" : "neutral") : "neutral" },
                { l: "SD1/SD2", v: preMetrics.poincare?.ratio, u: "", s: "neutral" },
              ].map((m,i) => <Card key={i} style={{ flex: 1, minWidth: "130px", padding: "10px" }}><Metric label={m.l} value={m.v} unit={m.u} severity={m.s} compact /></Card>)}
            </div>

            {/* Time context */}
            {(() => {
              const tc = HRV.getTimeContext(new Date().getHours());
              return (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "6px 12px", borderRadius: "6px", background: T.bgCard, marginBottom: "12px", fontSize: "11px", color: T.textMuted }}>
                  <span>🕐</span>
                  <span>{tc.label} — {tc.adjustment}</span>
                </div>
              );
            })()}

            {preDiag.findings.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", padding: "8px 12px", background: f.severity === "good" ? T.goodBg : f.severity === "warning" ? T.warnBg : T.bgCard, borderRadius: "8px", marginBottom: "4px", fontSize: "12px", color: T.text }}>
                <span>{f.severity === "good" ? "✅" : f.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                <span>{f.text}</span>
              </div>
            ))}

            {/* Recommended protocol */}
            {preDiag.recommendedProtocol && (
              <Card style={{ marginTop: "16px", border: `1px solid ${T.accent}30`, background: `${T.accent}06` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>🎯</span>
                  <span style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "14px" }}>Protocole recommandé</span>
                  <span style={{ marginLeft: "auto", fontFamily: T.fontMono, fontSize: "11px", color: T.accent, padding: "2px 8px", background: T.accentGlow, borderRadius: "8px" }}>
                    {preDiag.recommendedProtocol.confidence}%
                  </span>
                </div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>
                  {PROTOCOLS[preDiag.recommendedProtocol.protocol]?.name}
                </div>
                <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px" }}>{preDiag.recommendedProtocol.explain}</div>
                {preDiag.recommendedProtocol.reasons.map((r,i) => (
                  <div key={i} style={{ fontSize: "11px", color: T.textMuted, padding: "2px 0 2px 10px", borderLeft: `2px solid ${T.accent}40`, marginBottom: "3px" }}>{r}</div>
                ))}

                <details style={{ marginTop: "12px" }}>
                  <summary style={{ fontSize: "11px", color: T.textDim, cursor: "pointer" }}>Choisir un autre protocole</summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                    {Object.entries(PROTOCOLS).filter(([k]) => k !== "resonanceCustom").map(([k, p]) => (
                      <div key={k} onClick={() => setBreathProtocol(k)}
                        style={{ padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                          background: breathProtocol === k ? T.accentGlow : "transparent",
                          border: `1px solid ${breathProtocol === k ? T.accent + "40" : "transparent"}`,
                          color: breathProtocol === k ? T.accent : T.textMuted }}>
                        {p.name} — {p.desc}
                      </div>
                    ))}
                  </div>
                </details>

                <SliderInput label="Durée" value={breathDuration} onChange={setBreathDuration} min={60} max={600} step={30}
                  format={v => `${Math.floor(v/60)} min${v%60 ? ` ${v%60}s` : ""}`} />

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <input type="checkbox" checked={audioEnabled} onChange={e => setAudioEnabled(e.target.checked)} style={{ accentColor: T.accent }} />
                  <span style={{ fontSize: "12px", color: T.textMuted }}>Guide audio activé</span>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Ambiance visuelle</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {Object.entries(THEMES).map(([k, th]) => (
                      <div key={k} onClick={() => setVisualTheme(k)}
                        style={{
                          flex: 1, padding: "10px 8px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                          background: visualTheme === k ? T.accentGlow : T.bgCard,
                          border: `1px solid ${visualTheme === k ? T.accent + "40" : T.border}`,
                          transition: "all 0.2s",
                        }}>
                        <div style={{ fontSize: "20px", marginBottom: "2px" }}>{th.icon}</div>
                        <div style={{ fontSize: "11px", color: visualTheme === k ? T.accent : T.textMuted, fontWeight: 500 }}>{th.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Btn variant="primary" full onClick={() => { setSessionPhase("exercise"); startBreathing(); }}>
                  Lancer l'exercice
                </Btn>
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            BREATHING EXERCISE
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "exercise" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "12px" }}>
              {PROTOCOLS[breathProtocol]?.name} — {PROTOCOLS[breathProtocol]?.desc}
            </div>

            {/* Theme selector */}
            <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "16px" }}>
              {Object.entries(THEMES).map(([k, th]) => (
                <div key={k} onClick={() => setVisualTheme(k)}
                  style={{
                    padding: "5px 12px", borderRadius: "16px", cursor: "pointer", fontSize: "12px",
                    background: visualTheme === k ? T.accentGlow : "transparent",
                    border: `1px solid ${visualTheme === k ? T.accent + "50" : T.border}`,
                    color: visualTheme === k ? T.accent : T.textDim,
                    transition: "all 0.2s",
                  }}>
                  {th.icon} {th.name}
                </div>
              ))}
            </div>

            <BreathingVisual
              phase={breathPhase} progress={breathProgress} label={breathLabel}
              coherenceScore={liveCoherence} audioEnabled={audioEnabled}
              theme={visualTheme} width={340} height={340}
            />

            <div style={{ display: "flex", justifyContent: "center", gap: "28px", margin: "20px 0" }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: "26px", fontWeight: 700 }}>
                  {String(Math.floor((breathDuration - breathElapsed) / 60)).padStart(2,"0")}:{String(Math.floor((breathDuration - breathElapsed) % 60)).padStart(2,"0")}
                </div>
                <div style={{ fontSize: "10px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1px" }}>Restant</div>
              </div>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: "26px", fontWeight: 700 }}>{breathCycles}</div>
                <div style={{ fontSize: "10px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1px" }}>Cycles</div>
              </div>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: "26px", fontWeight: 700, color: T.accent }}>{currentHR || (demoMode ? 64 : "—")}</div>
                <div style={{ fontSize: "10px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1px" }}>BPM</div>
              </div>
            </div>

            <CoherenceGauge value={liveCoherence} />

            <div style={{ marginTop: "20px" }}>
              <Btn variant="secondary" onClick={stopBreathing}>Terminer l'exercice</Btn>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            POST MEASURE PROMPT
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "postMeasure" && !isRecording && !postMetrics && (
          <div style={{ textAlign: "center", paddingTop: "32px" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>✓</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>Exercice terminé</h2>
            <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "24px" }}>Mesurons l'impact sur votre système nerveux</p>
            <Btn variant="success" onClick={() => { setSessionPhase("postMeasure"); startMeasure(); }}>
              Mesure post-séance
            </Btn>
            <div style={{ marginTop: "12px" }}>
              <Btn variant="ghost" onClick={() => setSessionPhase("postQ")}>Passer</Btn>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            POST QUESTIONNAIRE
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "postQ" && (
          <div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "20px" }}>Comment vous sentez-vous ?</h2>

            {[
              { key: "wellbeing", label: "État général maintenant" },
              { key: "stress", label: "Niveau de stress maintenant" },
            ].map(q => (
              <Card key={q.key} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "10px", textAlign: "center" }}>{q.label}</div>
                <EmojiScale value={postQ[q.key]} onChange={v => setPostQ(p=>({...p, [q.key]: v}))} />
              </Card>
            ))}

            <Card style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", textAlign: "center" }}>L'exercice était...</div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                {["Facile", "Confortable", "Difficile", "Trop dur"].map((l, i) => (
                  <div key={i} onClick={() => setPostQ(p=>({...p, difficulty: i+1}))}
                    style={{ padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px",
                      background: postQ.difficulty === i+1 ? T.accentGlow : T.bgCard,
                      border: `1px solid ${postQ.difficulty === i+1 ? T.accent : T.border}`,
                      color: postQ.difficulty === i+1 ? T.accent : T.textMuted }}>{l}</div>
                ))}
              </div>
            </Card>

            <Card style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", textAlign: "center" }}>Ressentez-vous un changement ?</div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                {["Oui, nettement", "Un peu", "Pas vraiment", "Moins bien"].map((l, i) => (
                  <div key={i} onClick={() => setPostQ(p=>({...p, feltChange: i+1}))}
                    style={{ padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "11px",
                      background: postQ.feltChange === i+1 ? T.accentGlow : T.bgCard,
                      border: `1px solid ${postQ.feltChange === i+1 ? T.accent : T.border}`,
                      color: postQ.feltChange === i+1 ? T.accent : T.textMuted }}>{l}</div>
                ))}
              </div>
            </Card>

            <Btn variant="primary" full onClick={() => setSessionPhase("notes")}>Continuer</Btn>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            COACH NOTES
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "notes" && (
          <div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "20px" }}>Notes du coach</h2>
            <Card style={{ marginBottom: "16px" }}>
              <textarea value={coachNotes} onChange={e => setCoachNotes(e.target.value)}
                placeholder="Observations, contexte particulier, points à suivre..."
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${T.border}`, background: "rgba(0,0,0,0.2)", color: T.text, fontFamily: T.fontBody, fontSize: "13px", resize: "vertical", minHeight: "120px", outline: "none", boxSizing: "border-box" }} />
            </Card>
            <Btn variant="success" full onClick={saveSession}>Enregistrer et voir le bilan</Btn>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            RESULTS
        ══════════════════════════════════════════════════════ */}
        {sessionPhase === "results" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>
                Bilan de séance {activeClient ? `— ${activeClient.pseudo}` : ""}
              </h2>
              <p style={{ fontSize: "12px", color: T.textMuted, margin: 0 }}>
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {selectedProgram && ` • ${PROGRAMS[selectedProgram]?.name}`}
              </p>
            </div>

            {/* Questionnaire delta */}
            <Card style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Ressenti client</div>
              <div style={{ display: "flex", gap: "16px" }}>
                {[
                  { l: "Bien-être", pre: preQ.wellbeing, post: postQ.wellbeing },
                  { l: "Stress", pre: preQ.stress, post: postQ.stress, invert: true },
                ].map((q,i) => {
                  const d = q.post - q.pre;
                  const improved = q.invert ? d < 0 : d > 0;
                  return (
                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>{q.l}</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: "18px", color: d === 0 ? T.textMuted : improved ? T.good : T.bad, fontWeight: 600 }}>
                        {q.pre} → {q.post} <span style={{ fontSize: "12px" }}>({d > 0 ? "+" : ""}{d})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {postQ.feltChange === 1 && <div style={{ fontSize: "12px", color: T.good, marginTop: "8px", textAlign: "center" }}>✅ Le client ressent un changement net</div>}
              {postQ.feltChange === 4 && <div style={{ fontSize: "12px", color: T.bad, marginTop: "8px", textAlign: "center" }}>⚠️ Le client se sent moins bien — investiguer</div>}
            </Card>

            {/* Metrics comparison */}
            {preMetrics && postMetrics && (
              <Card style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Comparaison physiologique</div>
                {[
                  { k: "rmssd", l: "RMSSD", u: "ms", up: true },
                  { k: "sdnn", l: "SDNN", u: "ms", up: true },
                  { k: "meanHR", l: "FC moy.", u: "bpm", up: false },
                  { k: "stressIndex", l: "Stress Index", u: "", up: false },
                ].map(m => {
                  const bv = preMetrics[m.k], av = postMetrics[m.k];
                  if (bv === null || av === null) return null;
                  const d = ((av - bv) / bv) * 100;
                  const ok = m.up ? d > 0 : d < 0;
                  return (
                    <div key={m.k} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ flex: 1, fontSize: "12px", color: T.textMuted }}>{m.l}</span>
                      <span style={{ fontFamily: T.fontMono, fontSize: "14px", color: T.textMuted, width: "70px", textAlign: "right" }}>{bv.toFixed(1)}</span>
                      <span style={{ color: T.textDim, margin: "0 8px", fontSize: "12px" }}>→</span>
                      <span style={{ fontFamily: T.fontMono, fontSize: "14px", color: T.text, width: "70px", textAlign: "right", fontWeight: 600 }}>{av.toFixed(1)}</span>
                      <span style={{ fontFamily: T.fontMono, fontSize: "12px", color: ok ? T.good : d === 0 ? T.textMuted : T.bad, width: "60px", textAlign: "right", fontWeight: 600 }}>
                        {d > 0 ? "+" : ""}{d.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Decision support */}
            <Card style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Aide à la décision</div>
              {preMetrics && postMetrics && (() => {
                const d = ((postMetrics.rmssd - preMetrics.rmssd)/preMetrics.rmssd)*100;
                const isFirstSession = clientSessions.length <= 1;
                const poorSleep = preQ.sleep <= 2;
                const noResonance = !activeClient?.resonanceFreq;
                const coherenceImproved = postMetrics.coherence !== null && preMetrics.coherence !== null && postMetrics.coherence > preMetrics.coherence;
                const lfhfImproved = postMetrics.lfhf !== null && preMetrics.lfhf !== null && postMetrics.lfhf < preMetrics.lfhf;

                // Contextual factors
                const mitigating = [];
                if (isFirstSession) mitigating.push("Première séance — l'effet de nouveauté et la charge cognitive peuvent masquer les bénéfices");
                if (poorSleep) mitigating.push("Sommeil dégradé signalé — le SNA était en dette de récupération avant la séance");
                if (noResonance) mitigating.push("Fréquence de résonance non encore calibrée — le protocole générique n'est pas optimal");

                // Positive secondary signals
                const positives = [];
                if (coherenceImproved) positives.push(`Cohérence améliorée (${preMetrics.coherence.toFixed(0)}% → ${postMetrics.coherence.toFixed(0)}%)`);
                if (lfhfImproved) positives.push("Ratio LF/HF en baisse — tendance vers le parasympathique");
                if (postQ.wellbeing > preQ.wellbeing) positives.push("Le client se sent mieux (ressenti subjectif positif)");

                if (d > 15) {
                  return (
                    <div>
                      <div style={{ fontSize: "13px", color: T.good, fontWeight: 600, marginBottom: "6px" }}>✅ Réponse positive significative</div>
                      <div style={{ fontSize: "12px", color: T.textMuted }}>Le système nerveux autonome répond bien. Poursuite recommandée avec progression.</div>
                    </div>
                  );
                }
                if (d > 5) {
                  return (
                    <div>
                      <div style={{ fontSize: "13px", color: T.warn, fontWeight: 600, marginBottom: "6px" }}>⚡ Amélioration modérée (+{d.toFixed(0)}%)</div>
                      <div style={{ fontSize: "12px", color: T.textMuted }}>Le système répond partiellement. Ajuster le protocole ou augmenter la durée.</div>
                      {positives.length > 0 && (
                        <div style={{ marginTop: "6px" }}>
                          {positives.map((p, i) => <div key={i} style={{ fontSize: "11px", color: T.good, padding: "2px 0 2px 8px", borderLeft: `2px solid ${T.good}30` }}>✓ {p}</div>)}
                        </div>
                      )}
                    </div>
                  );
                }
                // Negative or flat result
                return (
                  <div>
                    <div style={{ fontSize: "13px", color: mitigating.length > 0 ? T.warn : T.bad, fontWeight: 600, marginBottom: "6px" }}>
                      {mitigating.length > 0 ? "📋 Résultat à contextualiser" : "📋 Réponse limitée"}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px" }}>
                      Le RMSSD n'a pas augmenté cette séance ({d > 0 ? "+" : ""}{d.toFixed(0)}%). {mitigating.length > 0 ? "Plusieurs facteurs peuvent expliquer ce résultat :" : "Envisager un changement de protocole."}
                    </div>
                    {mitigating.length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        {mitigating.map((m, i) => <div key={i} style={{ fontSize: "11px", color: T.warn, padding: "3px 0 3px 8px", borderLeft: `2px solid ${T.warn}30`, marginBottom: "3px" }}>⚠ {m}</div>)}
                      </div>
                    )}
                    {positives.length > 0 && (
                      <div style={{ marginBottom: "6px" }}>
                        <div style={{ fontSize: "10px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>Signaux positifs malgré tout</div>
                        {positives.map((p, i) => <div key={i} style={{ fontSize: "11px", color: T.good, padding: "2px 0 2px 8px", borderLeft: `2px solid ${T.good}30` }}>✓ {p}</div>)}
                      </div>
                    )}
                    {noResonance && (
                      <Btn variant="secondary" onClick={() => { resetSession(); setView("resonance"); }} style={{ marginTop: "8px", fontSize: "12px" }}>
                        🎯 Faire la recherche de résonance
                      </Btn>
                    )}
                  </div>
                );
              })()}
              {!postMetrics && <div style={{ fontSize: "13px", color: T.textMuted }}>Pas de mesure post-séance enregistrée.</div>}
              <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "6px", background: T.warnBg, fontSize: "10px", color: "#b8a070", lineHeight: "1.5" }}>
                <strong>AVERTISSEMENT :</strong> Cette analyse ne constitue pas un diagnostic médical. En cas de doute, orientez vers un professionnel de santé.
              </div>
            </Card>

            {coachNotes && (
              <Card style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Notes du coach</div>
                <div style={{ fontSize: "13px", color: T.text, lineHeight: "1.5" }}>{coachNotes}</div>
              </Card>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <Btn variant="primary" onClick={() => { resetSession(); setView("home"); }}>Nouvelle séance</Btn>
              <Btn variant="secondary" onClick={generatePDF}>📄 Rapport</Btn>
              <Btn variant="secondary" onClick={() => setView("dashboard")}>Historique</Btn>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            RESONANCE SEARCH VIEW
        ══════════════════════════════════════════════════════ */}
        {view === "resonance" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, margin: 0 }}>
                🎯 Recherche de résonance
              </h2>
              <Btn variant="ghost" onClick={cancelResonance}>← Retour</Btn>
            </div>

            {!resonanceActive && resonanceResults.length === 0 && (
              <div>
                <Card style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "13px", color: T.text, lineHeight: "1.6", marginBottom: "12px" }}>
                    Ce protocole teste 5 fréquences respiratoires différentes (de 6.5 à 4.5 resp/min) pendant 2 minutes chacune. L'app mesure la variabilité cardiaque à chaque fréquence et identifie celle où votre système nerveux répond le mieux.
                  </div>
                  <div style={{ fontSize: "12px", color: T.textMuted, lineHeight: "1.5", marginBottom: "12px" }}>
                    Durée totale : ~12 minutes (5 × 2 min + transitions). Le client doit porter la ceinture H10 et suivre le guide visuel de respiration à chaque palier.
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {resonanceFreqs.map((f, i) => (
                      <div key={i} style={{ padding: "6px 12px", borderRadius: "8px", background: T.bgCard, border: `1px solid ${T.border}`, fontSize: "12px", color: T.textMuted }}>
                        Palier {i + 1} : {f} resp/min ({(60/f).toFixed(1)}s/cycle)
                      </div>
                    ))}
                  </div>
                </Card>
                <Btn variant="primary" full onClick={() => startResonanceStep(0)} disabled={!bleOk}>
                  {bleOk ? "Démarrer la recherche" : "Connectez le H10 d'abord"}
                </Btn>
              </div>
            )}

            {/* Active step */}
            {resonanceActive && (
              <div>
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "4px" }}>
                    Palier {resonancePhase + 1} / 5
                  </div>
                  <div style={{ fontFamily: T.fontDisplay, fontSize: "22px", fontWeight: 700, color: T.accent }}>
                    {resonanceFreqs[resonancePhase]} respirations/min
                  </div>
                  <div style={{ fontSize: "12px", color: T.textMuted, marginTop: "4px" }}>
                    Cycle : {(60/resonanceFreqs[resonancePhase]/2).toFixed(1)}s inspire — {(60/resonanceFreqs[resonancePhase]/2).toFixed(1)}s expire
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>
                    <span>Progression</span>
                    <span>{resonanceTimer}s / {RESONANCE_STEP_DURATION}s</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${(resonanceTimer/RESONANCE_STEP_DURATION)*100}%`, height: "100%", background: T.accent, borderRadius: "3px", transition: "width 0.5s" }} />
                  </div>
                </div>

                {/* Mini breathing guide for current freq */}
                <Card style={{ textAlign: "center", padding: "24px", marginBottom: "16px" }}>
                  <BreathingOrb
                    phase={(() => {
                      const cycleDur = 60 / resonanceFreqs[resonancePhase];
                      const half = cycleDur / 2;
                      const t = (resonanceTimer % cycleDur);
                      return t < half ? "inhale" : "exhale";
                    })()}
                    progress={(() => {
                      const cycleDur = 60 / resonanceFreqs[resonancePhase];
                      const half = cycleDur / 2;
                      const t = (resonanceTimer % cycleDur);
                      return t < half ? t / half : (t - half) / half;
                    })()}
                    label={(() => {
                      const cycleDur = 60 / resonanceFreqs[resonancePhase];
                      const t = (resonanceTimer % cycleDur);
                      return t < cycleDur / 2 ? "INSPIREZ" : "EXPIREZ";
                    })()}
                    coherenceScore={null}
                    audioEnabled={false}
                  />
                </Card>

                {/* Steps progress */}
                <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                  {resonanceFreqs.map((f, i) => (
                    <div key={i} style={{
                      flex: 1, height: "32px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontFamily: T.fontMono, fontWeight: 600,
                      background: i < resonancePhase ? T.goodBg : i === resonancePhase ? T.accentGlow : T.bgCard,
                      border: `1px solid ${i < resonancePhase ? `${T.good}30` : i === resonancePhase ? `${T.accent}40` : T.border}`,
                      color: i < resonancePhase ? T.good : i === resonancePhase ? T.accent : T.textDim,
                    }}>
                      {i < resonanceResults.length ? `${resonanceResults[i].rmssd.toFixed(0)}` : `${f}/min`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {!resonanceActive && resonanceResults.length === 5 && (
              <div>
                {(() => {
                  const scored = computeResonanceScores(resonanceResults);
                  const best = scored.find(s => s.isBest);
                  const maxComposite = Math.max(...scored.map(s => s.compositeScore));
                  return (
                    <div>
                      <Card style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Score composite par fréquence</div>
                        
                        {/* Composite bar chart */}
                        <div style={{ display: "flex", alignItems: "end", gap: "8px", height: "140px", marginBottom: "16px" }}>
                          {scored.map((r, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                              <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: r.isBest ? T.good : T.textMuted, fontWeight: r.isBest ? 700 : 400 }}>
                                {(r.compositeScore * 100).toFixed(0)}
                              </span>
                              {/* Stacked bar showing metric contributions */}
                              <div style={{ width: "100%", maxWidth: "50px", display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden", height: `${(r.compositeScore / maxComposite) * 100}px`, minHeight: "4px", border: r.isBest ? `2px solid ${T.good}` : "none" }}>
                                <div style={{ height: `${r.nRmssd * 25}%`, background: "#4da6ff" }} title="RMSSD" />
                                <div style={{ height: `${r.nCoherence * 25}%`, background: "#3ddba0" }} title="Cohérence" />
                                <div style={{ height: `${r.nSdnn * 15}%`, background: "#a78bfa" }} title="SDNN" />
                                <div style={{ height: `${r.nDfa * 15}%`, background: "#f0b542" }} title="DFA" />
                                <div style={{ height: `${r.nSd1 * 10}%`, background: "#f06565" }} title="SD1" />
                                <div style={{ height: "10%", background: r.breathingValid !== false ? "#3ddba060" : "#f0656540" }} title="Validation" />
                              </div>
                              <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: r.isBest ? T.good : T.textDim, fontWeight: r.isBest ? 700 : 400 }}>
                                {r.breathsPerMin}/min
                              </span>
                              {r.breathingValid === false && (
                                <span style={{ fontSize: "8px", color: T.bad }}>⚠ rythme</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Legend */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", justifyContent: "center" }}>
                          {[["RMSSD", "#4da6ff", "25%"], ["Cohérence", "#3ddba0", "25%"], ["SDNN", "#a78bfa", "15%"], ["DFA α1", "#f0b542", "15%"], ["SD1", "#f06565", "10%"], ["Validation", "#3ddba060", "10%"]].map(([l, c, w]) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px", color: T.textMuted }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: c }} />
                              {l} ({w})
                            </div>
                          ))}
                        </div>

                        {/* Best result with confidence */}
                        {best && (
                          <div style={{ padding: "14px 16px", borderRadius: "10px", background: `${T.good}08`, border: `1px solid ${T.good}20` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: T.good }}>
                                🎯 Résonance : {best.breathsPerMin} resp/min
                              </div>
                              <div style={{
                                padding: "3px 10px", borderRadius: "12px", fontFamily: T.fontMono, fontSize: "11px", fontWeight: 600,
                                background: best.confidence >= 85 ? `${T.good}15` : best.confidence >= 70 ? `${T.warn}15` : `${T.bad}15`,
                                color: best.confidence >= 85 ? T.good : best.confidence >= 70 ? T.warn : T.bad,
                              }}>
                                Confiance {best.confidence}%
                              </div>
                            </div>
                            <div style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px" }}>
                              Cycle : {(best.cycleDuration / 2).toFixed(1)}s inspire / {(best.cycleDuration / 2).toFixed(1)}s expire
                            </div>

                            {/* Metric details for best */}
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {[
                                { l: "RMSSD", v: best.rmssd.toFixed(1), u: "ms" },
                                { l: "SDNN", v: best.sdnn.toFixed(1), u: "ms" },
                                { l: "Cohérence", v: best.coherence.toFixed(0), u: "%" },
                                { l: "DFA α1", v: best.dfa1 !== null ? best.dfa1.toFixed(2) : "—", u: "" },
                                { l: "SD1", v: best.poincareSd1.toFixed(1), u: "ms" },
                              ].map((m, i) => (
                                <div key={i} style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.2)", fontSize: "10px", color: T.textMuted }}>
                                  {m.l}: <span style={{ color: T.good, fontFamily: T.fontMono, fontWeight: 600 }}>{m.v}</span> {m.u}
                                </div>
                              ))}
                            </div>

                            {best.confidence < 75 && (
                              <div style={{ marginTop: "8px", fontSize: "11px", color: T.warn }}>
                                ⚠ Confiance modérée — les métriques ne convergent pas toutes vers la même fréquence. Envisager de refaire le test dans de meilleures conditions.
                              </div>
                            )}
                          </div>
                        )}
                      </Card>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <Btn variant="success" full onClick={finishResonance}>
                          Enregistrer dans le profil client
                        </Btn>
                        <Btn variant="secondary" onClick={cancelResonance}>Annuler</Btn>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            DASHBOARD
        ══════════════════════════════════════════════════════ */}
        {view === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: T.fontDisplay, fontSize: "20px", fontWeight: 700, margin: 0 }}>
                Historique {activeClient?.name}
              </h2>
              <Btn variant="ghost" onClick={() => { setView("home"); resetSession(); }}>← Retour</Btn>
            </div>

            {clientSessions.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "13px", color: T.textMuted }}>Aucune séance enregistrée</div>
              </Card>
            ) : (
              <div>
                {/* Evolution Intelligence */}
                {(() => {
                  const evo = EvolutionEngine.analyze(clientSessions, activeClient);
                  if (!evo) return null;
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      {/* Progress score */}
                      <Card style={{ marginBottom: "10px", background: `linear-gradient(135deg, ${T.accent}08, ${T.good}05)`, border: `1px solid ${T.accent}20` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "15px" }}>Score de progression</div>
                            <div style={{ fontSize: "11px", color: T.textMuted }}>{evo.sessionCount} séances • RMSSD {evo.firstRmssd || "—"} → {evo.lastRmssd || "—"} ms</div>
                          </div>
                          <div style={{
                            width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: `conic-gradient(${evo.progressScore > 60 ? T.good : evo.progressScore > 30 ? T.warn : T.bad} ${evo.progressScore * 3.6}deg, ${T.border} 0deg)`,
                          }}>
                            <div style={{
                              width: "46px", height: "46px", borderRadius: "50%", background: T.bg,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: T.fontMono, fontSize: "16px", fontWeight: 700, color: evo.progressScore > 60 ? T.good : evo.progressScore > 30 ? T.warn : T.bad,
                            }}>
                              {evo.progressScore}
                            </div>
                          </div>
                        </div>

                        {/* Insights */}
                        {evo.insights.map((ins, i) => (
                          <div key={i} style={{
                            display: "flex", gap: "6px", padding: "6px 10px", borderRadius: "6px", marginBottom: "4px",
                            background: ins.type === "good" ? T.goodBg : ins.type === "bad" ? T.badBg : T.warnBg,
                            fontSize: "12px", color: T.text,
                          }}>
                            <span>{ins.type === "good" ? "📈" : ins.type === "bad" ? "📉" : "⚡"}</span>
                            <span>{ins.text}</span>
                          </div>
                        ))}

                        {/* Actions */}
                        {evo.actions.length > 0 && (
                          <div style={{ marginTop: "8px" }}>
                            <div style={{ fontSize: "10px", color: T.textDim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Actions suggérées</div>
                            {evo.actions.map((a, i) => (
                              <div key={i} style={{ fontSize: "11px", color: T.textMuted, padding: "3px 0 3px 10px", borderLeft: `2px solid ${T.accent}30`, marginBottom: "3px" }}>
                                {a}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })()}

                {/* Evolution chart */}
                <Card style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Évolution RMSSD</div>
                  <div style={{ display: "flex", alignItems: "end", gap: "4px", height: "80px" }}>
                    {clientSessions.map((s, i) => {
                      const v = s.preMetrics?.rmssd || 0;
                      const max = Math.max(...clientSessions.map(x => x.preMetrics?.rmssd || 0), 50);
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: "9px", color: T.textMuted }}>{v.toFixed(0)}</span>
                          <div style={{ width: "100%", maxWidth: "40px", height: `${(v/max)*60}px`, background: `linear-gradient(to top, ${T.accent}40, ${T.accent})`, borderRadius: "4px 4px 0 0", minHeight: "4px" }} />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Session list */}
                {clientSessions.slice().reverse().map(s => (
                  <Card key={s.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>
                          {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {s.program && ` • ${PROGRAMS[s.program]?.icon} ${PROGRAMS[s.program]?.name}`}
                        </div>
                        <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>
                          RMSSD: {s.preMetrics?.rmssd?.toFixed(1) || "—"} → {s.postMetrics?.rmssd?.toFixed(1) || "—"} ms
                          {s.preMetrics && s.postMetrics && (() => {
                            const d = ((s.postMetrics.rmssd - s.preMetrics.rmssd)/s.preMetrics.rmssd)*100;
                            return <span style={{ color: d > 0 ? T.good : T.bad, fontFamily: T.fontMono }}> ({d > 0 ? "+" : ""}{d.toFixed(0)}%)</span>;
                          })()}
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: T.textMuted }}>
                        Bien-être: {s.preQ?.wellbeing} → {s.postQ?.wellbeing}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "12px 16px", borderTop: `1px solid ${T.border}`, fontSize: "9px", color: T.textDim, lineHeight: "1.5" }}>
        VitalCoach — Outil d'aide au coaching bien-être • Ne constitue pas un dispositif médical • Données RGPD
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        input[type="range"] { -webkit-appearance:none; height:3px; background:rgba(255,255,255,0.08); border-radius:2px; outline:none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:${T.accent}; cursor:pointer; }
        textarea:focus, input:focus { border-color: ${T.accent}60 !important; }
        ::selection { background: ${T.accent}30; }
        * { box-sizing: border-box; }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}
