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

// 2. Mapping optionnel des rôles
const roleMapping = {
  "1521576207299383386": { grade: "Capitaine-Stagiaire", qualif: "Officier de Police Judiciaire" }
};

// 3. Récupération des rôles Discord
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

// Variables globales de l'utilisateur
let dynamicGrade = "Agent";
let dynamicQualif = "Agent de Police Judiciaire";
let formattedNom = "INCONNU";
let formattedPrenom = "Agent";
let fullNameFormatted = "INCONNU Agent";

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

// 4. Nettoyage du pseudo Discord
function parseDiscordPseudo(rawPseudo) {
  if (!rawPseudo) return { nom: "INCONNU", prenom: "Agent" };
  const cleanPseudo = rawPseudo.replace(/\[.*?\]/g, '').trim();
  const parts = cleanPseudo.split(/\s+/);
  return {
    nom: (parts[0] || "INCONNU").toUpperCase(),
    prenom: parts.slice(1).join(' ') || "Agent"
  };
}

// 5. Recherche et synchronisation des données utilisateur depuis l'Organigramme
function syncUserDataWithOrganigramme() {
  let matchedAgent = null;

  if (currentDiscordId && dbData.organigramme) {
    matchedAgent = dbData.organigramme.find(a => String(a.discordId) === String(currentDiscordId));
  }

  if (matchedAgent) {
    formattedNom = (matchedAgent.nom || "INCONNU").toUpperCase();
    formattedPrenom = matchedAgent.prenom ? matchedAgent.prenom.charAt(0).toUpperCase() + matchedAgent.prenom.slice(1).toLowerCase() : "Agent";
    dynamicGrade = matchedAgent.grade || "Agent";
    dynamicQualif = matchedAgent.qualiteJudiciaire || matchedAgent.qualif || matchedAgent.qualification || detectQualificationFromGrade(dynamicGrade);
  } else {
    const rawPseudoInput = urlParamsScript.get('pseudo') || sessionStorage.getItem('discord_pseudo') || "";
    const parsedPseudo = parseDiscordPseudo(rawPseudoInput);
    
    formattedNom = (urlParamsScript.get('nom') || parsedPseudo.nom).toUpperCase();
    formattedPrenom = urlParamsScript.get('prenom') || parsedPseudo.prenom;
    dynamicGrade = detectGradeFromRoles(userRoles);
    dynamicQualif = detectQualificationFromGrade(dynamicGrade);
  }

  fullNameFormatted = `${formattedNom} ${formattedPrenom}`;
  updateUI();
}

function detectGradeFromRoles(rolesList) {
  const urlGrade = urlParamsScript.get('grade') || sessionStorage.getItem('discord_grade');
  if (urlGrade) return urlGrade;

  for (const roleId of rolesList) {
    if (roleMapping[roleId] && roleMapping[roleId].grade) return roleMapping[roleId].grade;
  }

  for (const grade of ordreGrades) {
    if (rolesList.some(r => r.toLowerCase().replace(/[^a-z0-9]/g, '') === grade.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
      return grade;
    }
  }
  return "Capitaine-Stagiaire";
}

function detectQualificationFromGrade(grade) {
  const gradesOPJ = [
    "Commissaire Général", "Commissaire Divisionnaire", "Commissaire de Police", "Elève Commissaire",
    "Commandant Divisionnaire", "Commandant", "Capitaine", "Lieutenant", "Capitaine-Stagiaire", "Elève-Capitaine"
  ];
  return gradesOPJ.includes(grade) ? "Officier de Police Judiciaire" : "Agent de Police Judiciaire";
}

function updateUI() {
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
}

document.addEventListener("DOMContentLoaded", async () => {
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
  await loadData();
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
    if (!res.ok) throw new Error("Erreur de chargement des données");
    const json = await res.json();
    
    if (json.record) { 
      dbData = json.record;
      if (!Array.isArray(dbData.organigramme)) {
        dbData.organigramme = [];
      }
      if (!dbData.armurerie) {
        dbData.armurerie = {};
      }
    }
    
    syncUserDataWithOrganigramme();
    updateArmurerieCounts();
    renderOrganigrammeTable();
  } catch (e) { 
    console.error("Erreur loadData :", e); 
  }
}

async function saveData() {
  try { 
    await fetch(API_URL, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': MASTER_KEY }, 
      body: JSON.stringify(dbData) 
    }); 
  } catch (e) { 
    console.error("Erreur saveData :", e); 
  }
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

function openAddAgentModal() { 
  tempDiscordAgent = null;
  const idsToClear = ['modal-input-discord', 'modal-preview-name', 'modal-preview-grade', 'modal-preview-qj', 'modal-preview-spe', 'modal-input-rio', 'modal-input-phone'];
  idsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = '';
      else el.innerText = '—';
    }
  });
  document.getElementById('add-agent-modal').classList.remove('hidden'); 
}
function closeAddAgentModal() { document.getElementById('add-agent-modal').classList.add('hidden'); }

// CORRECTION MAJEURE : Récupération et affichage de toutes les données Discord
async function fetchDiscordData() {
  const idInput = document.getElementById('modal-input-discord');
  if (!idInput) return;
  const id = idInput.value.trim();
  if (!id) return alert("Veuillez saisir un ID Discord.");

  try {
    const res = await fetch(`/api/discord-user/${id}`);
    const data = await res.json();
    if (!data.success) return alert(data.message || "Utilisateur introuvable.");

    const parsed = parseDiscordPseudo(data.displayName);

    tempDiscordAgent = {
      discordId: id,
      nom: parsed.nom,
      prenom: parsed.prenom,
      grade: data.grade || "Non défini",
      qualiteJudiciaire: data.qualiteJudiciaire || "Aucune",
      specialite: data.specialite || "Aucune"
    };

    // Mettre à jour l'interface utilisateur de la modale
    const elName = document.getElementById('modal-preview-name');
    const elGrade = document.getElementById('modal-preview-grade');
    const elQJ = document.getElementById('modal-preview-qj');
    const elSpe = document.getElementById('modal-preview-spe');

    if (elName) elName.innerText = `${tempDiscordAgent.nom} ${tempDiscordAgent.prenom}`;
    if (elGrade) elGrade.innerText = tempDiscordAgent.grade;
    if (elQJ) elQJ.innerText = tempDiscordAgent.qualiteJudiciaire;
    if (elSpe) elSpe.innerText = tempDiscordAgent.specialite;

  } catch (e) { 
    console.error("Erreur lors de la récupération Discord :", e);
    alert("Impossible de communiquer avec le serveur.");
  }
}

// Validation de l'ajout d'un agent dans l'organigramme
async function submitAddAgent() {
  if (!tempDiscordAgent) {
    return alert("Veuillez d'abord charger un utilisateur Discord valide.");
  }

  const rio = document.getElementById('modal-input-rio')?.value.trim() || "";
  const phone = document.getElementById('modal-input-phone')?.value.trim() || "";
  const statusEl = document.getElementById('modal-select-status');
  const status = statusEl ? statusEl.value : "ACTIF";
  const intranetAccessEl = document.getElementById('modal-checkbox-intranet');
  const intranetAccess = intranetAccessEl ? intranetAccessEl.checked : true;

  const newAgent = {
    ...tempDiscordAgent,
    rio: rio,
    phone: phone,
    status: status,
    intranetAccess: intranetAccess
  };

  dbData.organigramme.push(newAgent);
  await saveData();
  renderOrganigrammeTable();
  closeAddAgentModal();
}

// CORRECTION MAJEURE : Affichage complet du tableau des agents avec actions (Supprimer / Modifier)
function renderOrganigrammeTable() {
  const tbody = document.getElementById('org-table-body');
  const countBadge = document.getElementById('total-agents-count') || document.getElementById('agents-count');
  
  if (countBadge) {
    const total = dbData.organigramme ? dbData.organigramme.length : 0;
    countBadge.innerText = `${total} agent${total > 1 ? 's' : ''}`;
  }

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!dbData.organigramme || dbData.organigramme.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">Aucun agent dans l'organigramme.</td></tr>`;
    return;
  }

  dbData.organigramme.forEach((agent, index) => {
    const icon = gradeIcons[agent.grade];
    tbody.innerHTML += `
      <tr class="border-b hover:bg-gray-50 text-sm">
        <td class="py-3 px-6 font-bold text-gray-900 uppercase">${agent.nom || ''} ${agent.prenom || ''}</td>
        <td class="py-3 px-6">
          <div class="flex items-center space-x-2">
            ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain">` : ''}
            <span>${agent.grade || '—'}</span>
          </div>
        </td>
        <td class="py-3 px-6">${agent.qualiteJudiciaire || agent.qualif || '—'}</td>
        <td class="py-3 px-6">${agent.specialite || '—'}</td>
        <td class="py-3 px-6 font-mono text-xs">${agent.rio || '—'}</td>
        <td class="py-3 px-6">
          <span class="px-2 py-1 rounded text-xs font-bold ${agent.status === 'ACTIF' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${agent.status || 'ACTIF'}
          </span>
        </td>
        <td class="py-3 px-6 text-right space-x-2">
          <button onclick="deleteOrgAgent(${index})" class="text-red-600 hover:text-red-800 font-bold text-xs uppercase">Supprimer</button>
        </td>
      </tr>
    `;
  });
}

// Suppression d'un agent de l'organigramme
async function deleteOrgAgent(index) {
  if (confirm("Êtes-vous sûr de vouloir supprimer cet agent de l'organigramme ?")) {
    dbData.organigramme.splice(index, 1);
    await saveData();
    renderOrganigrammeTable();
  }
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

function toggleDropdown() { 
  const el = document.getElementById('dropdown-options');
  if (el) el.classList.toggle('hidden'); 
}

function handleLogout() { sessionStorage.clear(); window.location.href = '/'; }