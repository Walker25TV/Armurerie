// ==================== RECUPERATION DES INFORMATIONS DISCORD ET UTILS ====================
const urlParamsScript = new URLSearchParams(window.location.search);

// Valeurs neutres par défaut (évite l'affichage de tes infos pour les autres utilisateurs)
const rawNom = urlParamsScript.get('nom') || sessionStorage.getItem('discord_nom') || sessionStorage.getItem('user_nom') || "INCONNU";
const rawPrenom = urlParamsScript.get('prenom') || sessionStorage.getItem('discord_prenom') || sessionStorage.getItem('user_prenom') || "Agent";
const formattedNom = rawNom.toUpperCase();
const formattedPrenom = rawPrenom.charAt(0).toUpperCase() + rawPrenom.slice(1).toLowerCase();
const fullNameFormatted = `${formattedNom} ${formattedPrenom}`;

const dynamicGrade = urlParamsScript.get('grade') || sessionStorage.getItem('discord_grade') || sessionStorage.getItem('user_grade') || "Gardien de la Paix";
const dynamicQualif = urlParamsScript.get('qualification') || sessionStorage.getItem('discord_qualif') || sessionStorage.getItem('user_qualif') || "Agent de Police Judiciaire";
const currentDiscordId = urlParamsScript.get('discord_id') || sessionStorage.getItem('discord_id');

const ROLE_ARMURERIE = "1521576291722330354";
const ROLE_COMMANDEMENT = "1521576207299383386";

function getUserRoles() {
  const rawRoles = urlParamsScript.get('roles') || sessionStorage.getItem('discord_roles') || "[]";
  try {
    const parsed = JSON.parse(rawRoles);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {
    if (typeof rawRoles === 'string') return rawRoles.split(',').map(r => r.trim());
  }
  return [];
}

const userRoles = getUserRoles();
const hasArmurerieRole = userRoles.includes(ROLE_ARMURERIE) || urlParamsScript.get('role_armurerie') === 'true';
const hasCommandementRole = userRoles.includes(ROLE_COMMANDEMENT) || urlParamsScript.get('role_commandement') === 'true';

const ordreGrades = [
  "Commissaire Général", "Commissaire Divisionnaire", "Commissaire de Police",
  "Elève Commissaire", "Commandant Divisionnaire", "Commandant", "Capitaine",
  "Lieutenant", "Capitaine-Stagiaire", "Elève-Capitaine", "Major Exceptionnel",
  "Major", "Brigadier-Chef", "Brigadier", "Sous-Brigadier",
  "Gardien de la Paix", "Gardien de la Paix Stagiaire", "Elève Gardien de la Paix", "Policier Adjoint"
];

// Chemins des images locales configurés avec le dossier Images/grades/
const gradeIcons = {
  // --- Commissaires ---
  "Commissaire Général": "Images/grades/COMG.png",
  "Commissaire Divisionnaire": "Images/grades/Commissaire Divisionnaire.png",
  "Commissaire de Police": "Images/grades/Comissaire De Police.png",
  "Elève Commissaire": "Images/grades/Élève Comissaire.png",

  // --- Officiers / Commandants / Capitaines / Lieutenants ---
  "Commandant Divisionnaire": "Images/grades/Commandant Divisionnaire.png",
  "Commandant": "Images/grades/Commandant De Police.png",
  "Capitaine": "Images/grades/Capitaine De Police.png",
  "Lieutenant": "Images/grades/Lieutenant De Police.png",
  "Capitaine-Stagiaire": "Images/grades/Capitaine Stagiaire.png",
  "Elève-Capitaine": "Images/grades/Élève Lieutenant.png",

  // --- Majors & Brigadiers ---
  "Major Exceptionnel": "Images/grades/MEEX.png",
  "Major": "Images/grades/Major de Police.png",
  "Brigadier-Chef": "Images/grades/Brigadier-Chef.png",
  "Brigadier": "Images/grades/Brigadier De Police.png",
  "Sous-Brigadier": "Images/grades/Sous Brigadier.png",

  // --- Gardiens de la Paix & Adjoints ---
  "Gardien de la Paix": "Images/grades/Gardien De La Paix.png",
  "Gardien de la Paix Stagiaire": "Images/grades/GPXS.png",
  "Elève Gardien de la Paix": "Images/grades/E-GPX.png",
  "Policier Adjoint": "Images/grades/PA.png"
};

let tempDiscordAgent = null;
const BIN_ID = "6a6bec81f5f4af5e29d80b84";
const MASTER_KEY = "$2a$10$4QakocWzyo.QhFvScjsxXeXgsqEMnDvF4HHcLZtPWgrhRem/QURS.";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let currentWeapon = '';
let indexToDelete = null;
let orgIndexToDelete = null;

let dbData = {
  armurerie: {
    'PIE X26': [{ grade: 'Gardien de la Paix', nom: 'Bernard', prenom: 'Lucas', serie: 'X-99' }],
    'SIG SP 2022': [
      { grade: 'Brigadier Chef', nom: 'Hareta', prenom: 'Natsu', serie: '1' },
      { grade: 'Brigadier Chef', nom: 'Lopes', prenom: 'Julien', serie: '22' }
    ],
    'LBD 40': [{ grade: 'Brigadier', nom: 'Martin', prenom: 'Alexandre', serie: '05' }],
    'HK UMP 9': [{ grade: 'Gardien de la Paix', nom: 'Dupont', prenom: 'Jean', serie: '104' }],
    'HK G36': [{ grade: 'Capitaine', nom: 'Rousseau', prenom: 'Marc', serie: 'G36-01' }]
  },
  organigramme: []
};

// ==================== INITIALISATION ====================
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('sidebar-user-name')) document.getElementById('sidebar-user-name').innerText = fullNameFormatted;
  if (document.getElementById('sidebar-user-grade')) document.getElementById('sidebar-user-grade').innerText = dynamicGrade.toUpperCase();
  if (document.getElementById('topbar-auth-user')) document.getElementById('topbar-auth-user').innerText = fullNameFormatted;
  if (document.getElementById('welcome-user-name')) document.getElementById('welcome-user-name').innerText = fullNameFormatted;
  if (document.getElementById('identification-subtitle')) document.getElementById('identification-subtitle').innerText = `Identification : ${dynamicGrade} — ${fullNameFormatted}`;
  if (document.getElementById('profile-grade-title')) document.getElementById('profile-grade-title').innerText = dynamicGrade.toUpperCase();
  if (document.getElementById('qualification-judiciaire')) document.getElementById('qualification-judiciaire').innerText = dynamicQualif;

  // Icône du grade
  const iconUrl = gradeIcons[dynamicGrade];
  if (iconUrl) {
    const sbIcon = document.getElementById('sidebar-user-grade-icon');
    const pIcon = document.getElementById('profile-grade-icon');
    if (sbIcon) { sbIcon.src = iconUrl; sbIcon.classList.remove('hidden'); }
    if (pIcon) { pIcon.src = iconUrl; pIcon.classList.remove('hidden'); }
  }

  // Rôles & Affichage des menus
  const navArm = document.getElementById('nav-armurerie');
  const navCmd = document.getElementById('nav-commandement');
  if (hasArmurerieRole || hasCommandementRole) {
    if (navArm) navArm.classList.remove('hidden');
  }
  if (hasCommandementRole) {
    if (navCmd) navCmd.classList.remove('hidden');
  }

  // Confirmation de suppression d'arme
  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (indexToDelete !== null && dbData.armurerie[currentWeapon]) {
        dbData.armurerie[currentWeapon].splice(indexToDelete, 1);
        saveData();
        renderWeaponTable();
        updateArmurerieCounts();
      }
      closeDeleteModal();
    });
  }

  setupCustomSelect();
  loadData();
});
// ... (le reste du code reste identique) ...