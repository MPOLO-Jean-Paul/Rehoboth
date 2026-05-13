const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// Fix SoinsNavPanel.js
// ─────────────────────────────────────────────────────────────
let navContent = fs.readFileSync('./src/components/SoinsNavPanel.js', 'utf8');

// Line 41: broken title
navContent = navContent.replace(
  `{\"NAVIGATION SOINS'</Text>`,
  `NAVIGATION SOINS</Text>`
);

// Line 42: broken subtitle with undefined t reference
navContent = navContent.replace(
  `{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "MODULE INFIRMIER"}`,
  `MODULE INFIRMIER`
);

fs.writeFileSync('./src/components/SoinsNavPanel.js', navContent, 'utf8');
console.log('✅ SoinsNavPanel.js fixed');

// ─────────────────────────────────────────────────────────────
// Fix AdminScreen.js - batch replacements
// ─────────────────────────────────────────────────────────────
let content = fs.readFileSync('./src/screens/AdminScreen.js', 'utf8');
let fixCount = 0;

const fixes = [
  // ── Header title ──
  [`title={"REHOBOTH'`, `title="REHOBOTH"`],

  // ── Dashboard section ──
  [`{"VOIR LE DÉTAIL DES REVENUS'`, `"VOIR LE DÉTAIL DES REVENUS"`],
  [`name={"` , null], // handled specifically below
  [`{"RÉPARTITION DES REVENUS'`, `"RÉPARTITION DES REVENUS"`],
  [`{"Aucun revenu enregistré.'`, `"Aucun revenu enregistré."`],

  // ── Users section ──
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "PERSONNEL"}`, `"PERSONNEL"`],
  [`{"AJOUTER'`, `"AJOUTER"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "ACTIF"}`, `"ACTIF"`],

  // ── Patients section ──
  [`{"BASE PATIENTS'`, `"BASE PATIENTS"`],
  [`{"Chercher par nom ou numéro...'`, `"Chercher par nom ou numéro..."`],
  [`{"RETOUR AUX DOSSIERS'`, `"RETOUR AUX DOSSIERS"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "DOSSIER MENSUEL"}`, `"DOSSIER MENSUEL"`],

  // ── Messaging section ──
  [`{"BROADCAST & EMAILS'`, `"BROADCAST & EMAILS"`],
  [`{"ANNULER'`, `"ANNULER"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "OBJET"}`, `"OBJET"`],
  [`{"Objet du message...'`, `"Objet du message..."`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "MESSAGE"}`, `"MESSAGE"`],
  [`{"Contenu du broadcast...'`, `"Contenu du broadcast..."`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "DESTINATAIRES"}`, `"DESTINATAIRES"`],
  [`{"PRIORITÉ'`, `"PRIORITÉ"`],
  [`{"MESSAGES REÇUS'`, `"MESSAGES REÇUS"`],
  [`{"Aucun message reçu pour le moment.'`, `"Aucun message reçu pour le moment."`],

  // ── Stats section ──
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "BILAN & ANALYTIQUE"}`, `"BILAN & ANALYTIQUE"`],
  [`{"INDEX DE PERFORMANCE GLOBALE'`, `"INDEX DE PERFORMANCE GLOBALE"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "A+"}`, `"A+"`],
  [`{"BASÉ SUR LE FLUX DE PATIENTS ET LES REVENUS DU MOIS'`, `"BASÉ SUR LE FLUX DE PATIENTS ET LES REVENUS DU MOIS"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "RÉPARTITION DU FLUX ACTUEL"}`, `"RÉPARTITION DU FLUX ACTUEL"`],
  [`{"Aucune donnée de flux en direct.'`, `"Aucune donnée de flux en direct."`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "TOP ASSURANCES"}`, `"TOP ASSURANCES"`],
  [`{"ALERTES CRITIQUES'`, `"ALERTES CRITIQUES"`],
  [`{"STOCK FAIBLE'`, `"STOCK FAIBLE"`],
  [`{"STOCK STABLE'`, `"STOCK STABLE"`],
  [`{"URGENCES ATTENTE'`, `"URGENCES ATTENTE"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "BILAN ET RENDEMENT DES SERVICES"}`, `"BILAN ET RENDEMENT DES SERVICES"`],
  [`{"RAPPORTS AUTOMATIQUES'`, `"RAPPORTS AUTOMATIQUES"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "Recevoir le bilan par email/notif"}`, `"Recevoir le bilan par email/notif"`],
  [`{"GÉNÉRER BILAN COMPLET'`, `"GÉNÉRER BILAN COMPLET"`],

  // ── Notifications section ──
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "NOTIFICATIONS"}`, `"NOTIFICATIONS"`],
  [`{"Aucune notification pour le moment.'`, `"Aucune notification pour le moment."`],

  // ── Insurances section ──
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "ASSURANCES"}`, `"ASSURANCES"`],
  [`{"GESTION & RENTABILITÉ'`, `"GESTION & RENTABILITÉ"`],
  [`{"NOUVEAU'`, `"NOUVEAU"`],
  [`{"CONSOMMATION'`, `"CONSOMMATION"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "FORFAIT"}`, `"FORFAIT"`],
  [`{"POURCENTAGE MEMBRES'`, `"NB MEMBRES"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "PERSONNES"}`, `"PERSONNES"`],
  [`{"VALEUR MENSUELLE'`, `"VALEUR MENSUELLE"`],
  [`{"Chercher une compagnie...'`, `"Chercher une compagnie..."`],

  // ── Pricing section ──
  [`{"CATALOGUE'`, `"CATALOGUE"`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "GESTION DES PRIX & SERVICES"}`, `"GESTION DES PRIX & SERVICES"`],
  [`{"Chercher un service ou produit...'`, `"Chercher un service ou produit..."`],
  [`{(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "Dosage (ex: 500mg)..."}`, `"Dosage (ex: 500mg)..."`],
  [`{"FC'`, `"FC"`],
];

// Apply all simple string fixes
for (const [from, to] of fixes) {
  if (to === null) continue;
  const before = content;
  content = content.split(from).join(to);
  if (content !== before) fixCount++;
}

// Fix empty icon names with correct ones
const iconFixes = [
  // Dashboard
  [/name={""\}\s*size={14}\s*color="rgba\(255,255,255,0\.7\)"/g, 'name="chevron-right" size={14} color="rgba(255,255,255,0.7)"'],
  [/name={""\}\s*size={18}\s*color=\{brandColor\}/g, 'name="chart-pie" size={18} color={brandColor}'],
  // Messaging
  [/name=\{broadcast\.id \? "" : "email-fast-outline"\}/g, 'name={broadcast.id ? "edit" : "email-fast-outline"}'],
  [/name=\{broadcast\.id \? "" : "send"\}/g, 'name={broadcast.id ? "save" : "send"}'],
  [/name={""\}\s*size={22}\s*color=\{brandColor\}[\s\S]{0,30}onPress=\{fetchGlobalData\}/g, (m) => m.replace('name=""', 'name="refresh"')],
  // Stats
  [/name={""\}\s*size={20}\s*color=\{C\.danger\}/g, 'name="pill-off" size={20} color={C.danger}'],
  [/name={""\}\s*size={20}\s*color="#22C55E"/g, 'name="check-circle" size={20} color="#22C55E"'],
  [/name={""\}\s*size={20}\s*color="#F59E0B"/g, 'name="clock-alert" size={20} color="#F59E0B"'],
  // Insurances
  [/name={""\}\s*size={18}\s*color="#FFF"[\s\S]{0,50}NOUVEAU/g, (m) => m.replace('name=""', 'name="add"')],
  [/name=\{isProfit \? "" : "trending-down"\}/g, 'name={isProfit ? "trending-up" : "trending-down"}'],
  [/name={""\}\s*size={26}\s*color="#FFF"/g, 'name="shield-account" size={26} color="#FFF"'],
  [/name={""\}\s*size={14}\s*color=\{C\.sub\}/g, 'name="phone" size={14} color={C.sub}'],
  // Patients
  [/name={""\}\s*size={22}\s*color=\{brandColor\}[\s\S]{0,50}Chercher par nom/g, (m) => m.replace('name=""', 'name="search"')],
  [/name={""\}\s*size={24}\s*color=\{brandColor\}/g, 'name="account-details" size={24} color={brandColor}'],
  // Pricing
  [/name={""\}\s*size={18}\s*color=\{C\.danger\}/g, 'name="delete" size={18} color={C.danger}'],
  // Messaging refresh
  [/name={""\}\s*size={22}\s*color=\{brandColor\}/g, 'name="refresh" size={22} color={brandColor}'],
];

for (const [pattern, replacement] of iconFixes) {
  const before = content;
  if (typeof replacement === 'string') {
    content = content.replace(pattern, replacement);
  } else {
    content = content.replace(pattern, replacement);
  }
  if (content !== before) fixCount++;
}

// Also fix any remaining empty name="" in the file
content = content.replace(/name={""\}/g, 'name="help-circle"');
content = content.replace(/name=""/g, 'name="help-circle"');

fs.writeFileSync('./src/screens/AdminScreen.js', content, 'utf8');
console.log(`✅ AdminScreen.js: ${fixCount} fixes applied`);

// ─────────────────────────────────────────────────────────────
// Also scan for remaining broken strings in ALL screens
// ─────────────────────────────────────────────────────────────
const path = require('path');
const dirs = ['./src/screens', './src/components'];
let remaining = [];

const scan = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (!file.endsWith('.js')) continue;
    const c = fs.readFileSync(full, 'utf8');
    // Check for broken apostrophe-ended strings
    const matches = c.match(/["'][^"'\n]{1,80}'\s*(?:<\/Text>|placeholderTextColor|style=)/g);
    if (matches) {
      remaining.push({ file: full, count: matches.length, samples: matches.slice(0,3) });
    }
  }
};

dirs.forEach(scan);

if (remaining.length > 0) {
  console.log('\n⚠️  Remaining broken strings found:');
  remaining.forEach(r => {
    console.log(`  📄 ${path.basename(r.file)} (${r.count} issues)`);
    r.samples.forEach(s => console.log(`     → ${s.substring(0, 80)}`));
  });
} else {
  console.log('\n✅ No remaining broken strings found in any file!');
}
