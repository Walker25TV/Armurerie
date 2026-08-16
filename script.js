// ==================== RECUPERATION DES INFORMATIONS DISCORD ET UTILS ====================
const urlParamsScript = new URLSearchParams(window.location.search);

// 1. Liste des grades dans l'ordre hiérarchique exact
const ordreGrades = [
  "Commissaire Général", "Commissaire Divisionnaire", "Commissaire de Police",
  "Elève Commissaire", "Commandant Divisionnaire", "Commandant", "Capitaine",
  "Lieutenant", "Capitaine-Stagiaire", "Elève-Capitaine", "Major Exceptionnel",
  "Major", "Brigadier-Chef", "Brigadier", "Sous-Brigadier",
  "Gardien de la Paix", "Gardien de la Paix Stagiaire", "Elève Gardien de la Paix", "Policier Adjoint"
];

// 2. Fonction pour récupérer et nettoyer les rôles de l'utilisateur
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

// 3. Détection automatique du grade (avec valeur de secours sécurisée)
function detectGradeFromRoles(rolesList) {
  const urlGrade = urlParamsScript.get('grade') || sessionStorage.getItem('discord_grade') || sessionStorage.getItem('user_grade');
  if (urlGrade) return urlGrade;

  for (const grade of ordreGrades) {
    const found = rolesList.some(r => r.toLowerCase().replace(/[^a-z0-9]/g, '') === grade.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (found) return grade;
  }
  
  // Valeur de secours par défaut si l'URL est vide
  return "Capitaine-Stagiaire"; 
}

const dynamicGrade = detectGradeFromRoles(userRoles);

// 4. Fonction pour nettoyer le pseudo Discord (ex: "[TL-S-206] WALKER Chris" -> Nom: WALKER, Prénom: Chris)
function parseDiscordPseudo(rawPseudo) {
  if (!rawPseudo) return { nom: "INCONNU", prenom: "Agent" };
  const cleanPseudo = rawPseudo.replace(/\[.*?\]/g, '').trim();
  const parts = cleanPseudo.split(/\s+/);
  return {
    nom: (parts[0] || "INCONNU").toUpperCase(),
    prenom: parts.slice(1).join(' ') || "Agent"
  };
}

// Récupération avec secours forcé si l'URL est totalement vide
const rawPseudoInput = urlParamsScript.get('pseudo') || sessionStorage.getItem('discord_pseudo') || sessionStorage.getItem('user_pseudo') || "[TL-S-206] WALKER Chris";
const parsedPseudo = parseDiscordPseudo(rawPseudoInput);

const rawNom = urlParamsScript.get('nom') || sessionStorage.getItem('discord_nom') || sessionStorage.getItem('user_nom') || parsedPseudo.nom;
const rawPrenom = urlParamsScript.get('prenom') || sessionStorage.getItem('discord_prenom') || sessionStorage.getItem('user_prenom') || parsedPseudo.prenom;

const formattedNom = rawNom.toUpperCase();
const formattedPrenom = rawPrenom.charAt(0).toUpperCase() + rawPrenom.slice(1).toLowerCase();
const fullNameFormatted = `${formattedNom} ${formattedPrenom}`;

const dynamicQualif = urlParamsScript.get('qualification') || sessionStorage.getItem('discord_qualif') || sessionStorage.getItem('user_qualif') || "Agent de Police Judiciaire";
const currentDiscordId = urlParamsScript.get('discord_id') || sessionStorage.getItem('discord_id');

const ROLE_ARMURERIE = "1521576291722330354";
const ROLE_COMMANDEMENT = "1521576207299383386";

const hasArmurerieRole = userRoles.includes(ROLE_ARMURERIE) || urlParamsScript.get('role_armurerie') === 'true';
const hasCommandementRole = userRoles.includes(ROLE_COMMANDEMENT) || urlParamsScript.get('role_commandement') === 'true';

const gradeIcons = {
  "Commissaire Général": "Images/grades/COMG.png",
  "Commissaire Divisionnaire": "Images/grades/Commissaire Divisionnaire.png",
  "Commissaire de Police": "Images/grades/Comissaire De Police.png",
  "Elève Commissaire": "Images/grades/Élève Comissaire.png",
  "Commandant Divisionnaire": "Images/grades/Commandant Divisionnaire.png",
  "Commandant": "Images/grades/Commandant De Police.png",
  "Capitaine": "Images/grades/Capitaine De Police.png",
  "Lieutenant": "Images/grades/Lieutenant De Police.png",
  "Capitaine-Stagiaire": "Images/grades/Capitaine Stagiaire.png",
  "Elève-Capitaine": "Images/grades/Élève Lieutenant.png",
  "Major Exceptionnel": "Images/grades/MEEX.png",
  "Major": "Images/grades/Major de Police.png",
  "Brigadier-Chef": "Images/grades/Brigadier-Chef.png",
  "Brigadier": "Images/grades/Brigadier De Police.png",
  "Sous-Brigadier": "Images/grades/Sous Brigadier.png",
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

let dbData = { armurerie: {}, organigramme: [] };

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('sidebar-user-name')) document.getElementById('sidebar-user-name').innerText = fullNameFormatted;
  if (document.getElementById('sidebar-user-grade')) document.getElementById('sidebar-user-grade').innerText = dynamicGrade.toUpperCase();
  if (document.getElementById('topbar-auth-user')) document.getElementById('topbar-auth-user').innerText = fullNameFormatted;
  if (document.getElementById('welcome-user-name')) document.getElementById('welcome-user-name').innerText = fullNameFormatted;
  if (document.getElementById('identification-subtitle')) document.getElementById('identification-subtitle').innerText = `Identification : ${dynamicGrade} — ${fullNameFormatted}`;
  if (document.getElementById('profile-grade-title')) document.getElementById('profile-grade-title').innerText = dynamicGrade.toUpperCase();
  if (document.getElementById('qualification-judiciaire')) document.getElementById('qualification-judiciaire').innerText = dynamicQualif;

  const iconUrl = gradeIcons[dynamicGrade];
  if (iconUrl) {
    const sbIcon = document.getElementById('sidebar-user-grade-icon');
    const pIcon = document.getElementById('profile-grade-icon');
    if (sbIcon) { sbIcon.src = iconUrl; sbIcon.classList.remove('hidden'); }
    if (pIcon) { pIcon.src = iconUrl; pIcon.classList.remove('hidden'); }
  }

  const navArm = document.getElementById('nav-armurerie');
  const navCmd = document.getElementById('nav-commandement');
  if (hasArmurerieRole || hasCommandementRole) { if (navArm) navArm.classList.remove('hidden'); }
  if (hasCommandementRole) { if (navCmd) navCmd.classList.remove('hidden'); }

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

function switchView(viewName) {
  const views = ['accueil', 'organigramme', 'armurerie-container', 'commandement'];
  views.forEach(v => { const el = document.getElementById(`view-${v}`); if (el) el.classList.add('hidden'); });
  ['accueil', 'organigramme', 'armurerie', 'commandement'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (btn) { btn.classList.remove('bg-blue-900', 'text-white'); btn.classList.add('text-gray-700', 'hover:bg-gray-100'); }
  });
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');
  const targetBtn = document.getElementById(`nav-${viewName}`);
  if (targetBtn) { targetBtn.classList.add('bg-blue-900', 'text-white'); targetBtn.classList.remove('text-gray-700', 'hover:bg-gray-100'); }
  if (viewName === 'armurerie-container') showArmurerieOverview();
}

async function loadData() {
  try {
    const res = await fetch(API_URL, { headers: { 'X-Master-Key': MASTER_KEY } });
    if (!res.ok) throw new Error("Erreur");
    const json = await res.json();
    if (json.record) { dbData = json.record; }
    updateArmurerieCounts();
    renderOrganigrammeTable();
  } catch (e) { console.error(e); }
}

async function saveData() {
  try { await fetch(API_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY }, body: JSON.stringify(dbData) }); } catch (e) { console.error(e); }
}

function updateArmurerieCounts() {
  let grandTotal = 0;
  for (const weapon in dbData.armurerie) {
    const count = dbData.armurerie[weapon].length;
    grandTotal += count;
    const el = document.getElementById(`count-${weapon}`);
    if (el) el.innerText = count;
  }
  const badge = document.getElementById('total-weapons-badge');
  if (badge) badge.innerText = `${grandTotal} arme${grandTotal > 1 ? 's' : ''} enregistrée${grandTotal > 1 ? 's' : ''} au total`;
}

function showArmurerieOverview() {
  document.getElementById('sub-view-armurerie').classList.remove('hidden');
  document.getElementById('sub-view-details').classList.add('hidden');
}

function showDetails(weaponName) {
  currentWeapon = weaponName;
  document.getElementById('breadcrumb-weapon-name').innerText = weaponName;
  document.getElementById('title-weapon-name').innerText = weaponName;
  renderWeaponTable();
  document.getElementById('sub-view-armurerie').classList.add('hidden');
  document.getElementById('sub-view-details').classList.remove('hidden');
}

function renderWeaponTable() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const items = dbData.armurerie[currentWeapon] || [];
  items.forEach((item, index) => {
    const icon = gradeIcons[item.grade];
    tbody.innerHTML += `<tr><td class="py-3.5 px-6 font-semibold"><div class="flex items-center space-x-2">${icon ? `<img src="${icon}" class="w-5 h-5 object-contain">` : ''}<span>${item.grade}</span></div></td><td class="py-3.5 px-6 uppercase">${item.nom}</td><td class="py-3.5 px-6 capitalize">${item.prenom}</td><td class="py-3.5 px-6 font-mono text-xs text-blue-900 font-bold">${item.serie}</td><td class="py-3.5 px-6 text-right"><button onclick="openDeleteModal(${index})" class="text-red-600 hover:text-red-800 text-xs font-bold uppercase tracking-wider">Supprimer</button></td></tr>`;
  });
}

function openDeleteModal(index) { indexToDelete = index; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { indexToDelete = null; document.getElementById('delete-modal').classList.add('hidden'); }

function openAddAgentModal() { document.getElementById('add-agent-modal').classList.remove('hidden'); }
function closeAddAgentModal() { document.getElementById('add-agent-modal').classList.add('hidden'); }

async function fetchDiscordData() {
  const id = document.getElementById('modal-input-discord').value.trim();
  if (!id) return;
  try {
    const res = await fetch(`/api/discord-user/${id}`);
    const data = await res.json();
    if (!data.success) return alert("Utilisateur introuvable.");
    
    const parsed = parseDiscordPseudo(data.displayName);
    tempDiscordAgent = { discordId: id, nom: parsed.nom, prenom: parsed.prenom, grade: "Capitaine-Stagiaire" };
    document.getElementById('modal-preview-name').innerText = `${tempDiscordAgent.prenom} ${tempDiscordAgent.nom}`;
  } catch (e) { console.error(e); }
}

function renderOrganigrammeTable() {
  const tbody = document.getElementById('org-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  dbData.organigramme.forEach((agent, index) => {
    tbody.innerHTML += `<tr><td class="py-3 px-6 font-bold text-gray-900">${agent.prenom} ${agent.nom}</td><td>${agent.grade}</td><td class="py-3 px-6"><button onclick="openOrgDeleteModal(${index})" class="text-red-600">Supprimer</button></td></tr>`;
  });
}

function setupCustomSelect() {
  const optionsDiv = document.getElementById('dropdown-options');
  if (!optionsDiv) return;
  ordreGrades.forEach(g => {
    const div = document.createElement('div');
    div.className = "px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm";
    div.innerText = g;
    div.onclick = () => { document.getElementById('input-grade').value = g; optionsDiv.classList.add('hidden'); };
    optionsDiv.appendChild(div);
  });
}
function toggleDropdown() { document.getElementById('dropdown-options').classList.toggle('hidden'); }
function handleLogout() { sessionStorage.clear(); window.location.href = '/'; }