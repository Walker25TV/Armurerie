// ==================== RECUPERATION DES INFORMATIONS DISCORD ET UTILS ====================
const urlParamsScript = new URLSearchParams(window.location.search);

// 1. Liste des grades dans l'ordre hiérarchique exact (sans le corps de conception et de direction)
const ordreGrades = [
  "Directeur Général",
  "Commissaire Général",
  "Commissaire Divisionnaire",
  "Commissaire de Police",
  "Elève Commissaire",
  "Commandant Divisionnaire",
  "Commandant",
  "Capitaine",
  "Lieutenant",
  "Capitaine-Stagiaire",
  "Elève-Capitaine",
  "Major Exceptionnel",
  "Major",
  "Brigadier-Chef",
  "Brigadier",
  "Sous-Brigadier",
  "Gardien de la Paix",
  "Gardien de la Paix Stagiaire",
  "Elève Gardien de la Paix",
  "Policier Adjoint"
];

// 2. Mapping optionnel des rôles (nettoyé pour éviter d'imposer un grade statique bloquant)
const roleMapping = {};

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
  "Directeur Général": "Images/grades/Comissaire De Police.png",
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
let editingOrgAgentIndex = null;

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

// 5. Recherche et synchronisation des données utilisateur depuis l'Organigramme (Avec priorité Discord)
function syncUserDataWithOrganigramme() {
  let matchedAgent = null;

  const rawPseudoInput = urlParamsScript.get('pseudo') || sessionStorage.getItem('discord_pseudo') || "";
  const parsedPseudo = parseDiscordPseudo(rawPseudoInput);
  const searchNom = (urlParamsScript.get('nom') || parsedPseudo.nom).toUpperCase();
  const searchPrenom = (urlParamsScript.get('prenom') || parsedPseudo.prenom).toLowerCase();

  if (dbData.organigramme && dbData.organigramme.length > 0) {
    if (currentDiscordId) {
      matchedAgent = dbData.organigramme.find(a => String(a.discordId) === String(currentDiscordId));
    }
    if (!matchedAgent && searchNom) {
      matchedAgent = dbData.organigramme.find(a => 
        (a.nom || '').toUpperCase() === searchNom && 
        (a.prenom || '').toLowerCase() === searchPrenom
      );
    }
  }

  // Détection prioritaire basée sur les rôles réels de Discord
  const roleDetectedGrade = detectGradeFromRoles(userRoles);

  if (matchedAgent) {
    formattedNom = (matchedAgent.nom || "INCONNU").toUpperCase();
    formattedPrenom = matchedAgent.prenom ? matchedAgent.prenom.charAt(0).toUpperCase() + matchedAgent.prenom.slice(1).toLowerCase() : "Agent";
    
    // LE RÔLE DISCORD PREND LE DESSUS ABSOLU SUR L'ORGANIGRAMME
    dynamicGrade = roleDetectedGrade || matchedAgent.grade;
    dynamicQualif = matchedAgent.qualiteJudiciaire || matchedAgent.qualif || matchedAgent.qualification || detectQualificationFromRolesAndGrade(userRoles, dynamicGrade);
  } else {
    formattedNom = searchNom;
    formattedPrenom = searchPrenom.charAt(0).toUpperCase() + searchPrenom.slice(1);
    dynamicGrade = roleDetectedGrade;
    dynamicQualif = detectQualificationFromRolesAndGrade(userRoles, dynamicGrade);
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
    const gradeClean = grade.toLowerCase().replace(/[^a-z0-9à-ÿ-]/g, '');
    for (const role of rolesList) {
      const roleClean = String(role).toLowerCase().replace(/[^a-z0-9à-ÿ-]/g, '');
      
      const roleWords = roleClean.split(/[\s\-_|]+/);
      const gradeWords = gradeClean.split(/[\s\-_|]+/);

      const matchExact = roleClean === gradeClean || roleClean.includes(gradeClean);
      const matchWords = gradeWords.every(gw => roleWords.includes(gw));

      if (matchExact || matchWords) {
        return grade;
      }
    }
  }

  return "Sous-Brigadier";
}

function detectQualificationFromRolesAndGrade(rolesList, grade) {
  for (const role of rolesList) {
    const roleStr = String(role).toLowerCase();
    if (roleStr.includes('officier de police judiciaire')) {
      return "Officier de Police Judiciaire";
    }
    if (roleStr.includes('agent de police judiciaire adjoint')) {
      return "Agent de Police Judiciaire Adjoint";
    }
    if (roleStr.includes('agent de police judiciaire')) {
      return "Agent de Police Judiciaire";
    }
  }

  const gradesOPJ = [
    "Directeur Général", "Commissaire Général", "Commissaire Divisionnaire", "Commissaire de Police", "Elève Commissaire",
    "Commandant Divisionnaire", "Commandant", "Capitaine", "Lieutenant", "Capitaine-Stagiaire", "Elève-Capitaine",
    "Major Exceptionnel", "Major"
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

  const orgConfirmBtn = document.getElementById('org-confirm-delete-btn');
  if (orgConfirmBtn) {
    orgConfirmBtn.addEventListener('click', async () => {
      if (orgIndexToDelete !== null && dbData.organigramme) {
        dbData.organigramme.splice(orgIndexToDelete, 1);
        await saveData();
        renderOrganigrammeTable();
      }
      closeOrgDeleteModal();
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
      if (!Array.isArray(dbData.organigramme)) dbData.organigramme = [];
      if (!dbData.armurerie) dbData.armurerie = {};
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
    tbody.innerHTML += `
      <tr>
        <td class="py-3.5 px-6 font-semibold">
          <div class="flex items-center space-x-2">
            ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain">` : ''}
            <span>${item.grade}</span>
          </div>
        </td>
        <td class="py-3.5 px-6 uppercase">${item.nom}</td>
        <td class="py-3.5 px-6 capitalize">${item.prenom}</td>
        <td class="py-3.5 px-6 font-mono text-xs text-blue-900 font-bold">${item.serie}</td>
        <td class="py-3.5 px-6 text-right">
          <button type="button" onclick="openDeleteModal(${index})" class="text-red-600 hover:text-red-800 text-xs font-bold uppercase tracking-wider">Supprimer</button>
        </td>
      </tr>`;
  });
}

async function handleAddAgent(event) {
  event.preventDefault();
  const grade = document.getElementById('input-grade').value;
  const nom = document.getElementById('input-nom').value.trim();
  const prenom = document.getElementById('input-prenom').value.trim();
  const serie = document.getElementById('input-serie').value.trim();

  if (!grade || !nom || !prenom || !serie) {
    return alert("Veuillez remplir tous les champs du formulaire.");
  }

  if (!dbData.armurerie[currentWeapon]) {
    dbData.armurerie[currentWeapon] = [];
  }

  dbData.armurerie[currentWeapon].push({ grade, nom, prenom, serie });
  await saveData();

  document.getElementById('input-nom').value = '';
  document.getElementById('input-prenom').value = '';
  document.getElementById('input-serie').value = '';
  document.getElementById('input-grade').value = '';
  document.getElementById('selected-grade-text').innerText = 'Sélectionner un grade';
  document.getElementById('selected-grade-text').classList.add('text-gray-500');

  renderWeaponTable();
  updateArmurerieCounts();
}

function openDeleteModal(index) { indexToDelete = index; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { indexToDelete = null; document.getElementById('delete-modal').classList.add('hidden'); }

function openAddAgentModal() { 
  tempDiscordAgent = null;
  editingOrgAgentIndex = null;
  
  if (typeof isModalEditing !== 'undefined' && isModalEditing) {
    if (typeof toggleModalEditMode === 'function') toggleModalEditMode();
  }

  const idsToClear = ['modal-input-discord', 'modal-preview-name', 'modal-preview-grade', 'modal-preview-qualif', 'modal-preview-service', 'modal-input-rio', 'modal-input-phone', 'modal-input-name', 'modal-input-grade', 'modal-input-qualif', 'modal-input-service'];
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

function openOrgDeleteModal(index) { orgIndexToDelete = index; document.getElementById('org-delete-modal').classList.remove('hidden'); }
function closeOrgDeleteModal() { orgIndexToDelete = null; document.getElementById('org-delete-modal').classList.add('hidden'); }

async function fetchDiscordData(event) {
  if (event) event.preventDefault();
  const idInput = document.getElementById('modal-input-discord');
  if (!idInput) return;
  const id = idInput.value.trim();
  if (!id) return alert("Veuillez saisir un ID Discord.");

  try {
    const res = await fetch(`/api/discord-user/${id}`);
    const data = await res.json();
    if (!data.success) return alert(data.message || "Utilisateur introuvable.");

    const parsed = parseDiscordPseudo(data.displayName || data.username || "");

    const rolesDetected = data.roles || [];
    const gradeDetecte = data.grade && data.grade !== "Non défini" ? data.grade : detectGradeFromRoles(rolesDetected);
    const qualifDetectee = data.qualiteJudiciaire || data.qualif || detectQualificationFromRolesAndGrade(rolesDetected, gradeDetecte);

    tempDiscordAgent = {
      discordId: id,
      nom: parsed.nom,
      prenom: parsed.prenom,
      grade: gradeDetecte,
      qualiteJudiciaire: qualifDetectee,
      specialite: data.specialite || "Aucune"
    };

    const elName = document.getElementById('modal-preview-name');
    const elGrade = document.getElementById('modal-preview-grade');
    const elQualif = document.getElementById('modal-preview-qualif');
    const elSpe = document.getElementById('modal-preview-service');

    if (elName) elName.innerText = `${tempDiscordAgent.prenom} ${tempDiscordAgent.nom}`;
    if (elGrade) elGrade.innerText = tempDiscordAgent.grade;
    if (elQualif) elQualif.innerText = tempDiscordAgent.qualiteJudiciaire;
    if (elSpe) elSpe.innerText = tempDiscordAgent.specialite;

    const nameInput = document.getElementById('modal-input-name');
    const gradeInput = document.getElementById('modal-input-grade');
    const qualifInput = document.getElementById('modal-input-qualif');
    const serviceInput = document.getElementById('modal-input-service');

    if (nameInput) nameInput.value = `${tempDiscordAgent.prenom} ${tempDiscordAgent.nom}`;
    if (gradeInput) gradeInput.value = tempDiscordAgent.grade;
    if (qualifInput) qualifInput.value = tempDiscordAgent.qualiteJudiciaire;
    if (serviceInput) serviceInput.value = tempDiscordAgent.specialite;

  } catch (e) { 
    console.error("Erreur lors de la récupération Discord :", e);
    alert("Impossible de communiquer avec le serveur.");
  }
}

function editOrgAgent(index) {
  const agent = dbData.organigramme[index];
  if (!agent) return;

  editingOrgAgentIndex = index;
  tempDiscordAgent = { ...agent };

  openAddAgentModal();

  const idInput = document.getElementById('modal-input-discord');
  if (idInput) idInput.value = agent.discordId || "";

  const elName = document.getElementById('modal-preview-name');
  const elGrade = document.getElementById('modal-preview-grade');
  const elQualif = document.getElementById('modal-preview-qualif');
  const elSpe = document.getElementById('modal-preview-service');

  if (elName) elName.innerText = `${agent.prenom || ''} ${agent.nom || ''}`.trim();
  if (elGrade) elGrade.innerText = agent.grade || '—';
  if (elQualif) elQualif.innerText = agent.qualiteJudiciaire || agent.qualif || '—';
  if (elSpe) elSpe.innerText = agent.specialite || '—';

  const rioInput = document.getElementById('modal-input-rio');
  const phoneInput = document.getElementById('modal-input-phone');
  const statusInput = document.getElementById('modal-input-statut');
  const intranetInput = document.getElementById('modal-input-intranet');

  if (rioInput) rioInput.value = agent.rio || "";
  if (phoneInput) phoneInput.value = agent.phone || "";
  if (statusInput) statusInput.value = agent.status || "ACTIF";
  if (intranetInput) intranetInput.checked = agent.intranetAccess !== false;
}

async function handleModalAddOrgAgent(event) {
  event.preventDefault();

  const nameInput = document.getElementById('modal-input-name')?.value.trim();
  const gradeInput = document.getElementById('modal-input-grade')?.value.trim();
  const qualifInput = document.getElementById('modal-input-qualif')?.value.trim();
  const serviceInput = document.getElementById('modal-input-service')?.value.trim();

  let finalNom = tempDiscordAgent ? tempDiscordAgent.nom : "";
  let finalPrenom = tempDiscordAgent ? tempDiscordAgent.prenom : "";
  let finalGrade = tempDiscordAgent ? tempDiscordAgent.grade : "";
  let finalQualif = tempDiscordAgent ? tempDiscordAgent.qualiteJudiciaire : "";
  let finalSpecialite = tempDiscordAgent ? tempDiscordAgent.specialite : "Aucune";

  if (nameInput) {
    const parts = nameInput.split(/\s+/);
    finalPrenom = parts[0] || "";
    finalNom = parts.slice(1).join(' ') || "";
  }
  if (gradeInput) finalGrade = gradeInput;
  if (qualifInput) finalQualif = qualifInput;
  if (serviceInput) finalSpecialite = serviceInput;

  if (!finalNom && !finalPrenom) {
    return alert("Veuillez charger un utilisateur Discord ou renseigner le nom/prénom.");
  }

  const rio = document.getElementById('modal-input-rio')?.value.trim() || "";
  const phone = document.getElementById('modal-input-phone')?.value.trim() || "";
  const statusEl = document.getElementById('modal-input-statut');
  const status = statusEl ? statusEl.value : "ACTIF";
  const intranetAccessEl = document.getElementById('modal-input-intranet');
  const intranetAccess = intranetAccessEl ? intranetAccessEl.checked : true;

  const agentData = {
    discordId: tempDiscordAgent ? tempDiscordAgent.discordId : "",
    nom: finalNom,
    prenom: finalPrenom,
    grade: finalGrade,
    qualiteJudiciaire: finalQualif,
    specialite: finalSpecialite,
    rio: rio,
    phone: phone,
    status: status,
    intranetAccess: intranetAccess
  };

  if (editingOrgAgentIndex !== null) {
    dbData.organigramme[editingOrgAgentIndex] = agentData;
  } else {
    dbData.organigramme.push(agentData);
  }

  await saveData();
  renderOrganigrammeTable();
  closeAddAgentModal();
}

function renderOrganigrammeTable() {
  const tbody = document.getElementById('org-table-body');
  const total = (dbData.organigramme && Array.isArray(dbData.organigramme)) ? dbData.organigramme.length : 0;
  
  const orgTotalCount = document.getElementById('org-total-count');
  if (orgTotalCount) orgTotalCount.innerText = total;

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!dbData.organigramme || dbData.organigramme.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-500">Aucun agent dans l'organigramme.</td></tr>`;
    return;
  }

  const agentsWithOriginalIndex = dbData.organigramme.map((agent, index) => ({
    agent,
    originalIndex: index
  }));

  agentsWithOriginalIndex.sort((a, b) => {
    let indexA = ordreGrades.indexOf(a.agent.grade);
    let indexB = ordreGrades.indexOf(b.agent.grade);

    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;

    if (indexA !== indexB) {
      return indexA - indexB;
    }

    const nomA = (a.agent.nom || '').toUpperCase();
    const nomB = (b.agent.nom || '').toUpperCase();
    if (nomA !== nomB) return nomA.localeCompare(nomB);

    return (a.agent.prenom || '').localeCompare(b.agent.prenom || '');
  });

  agentsWithOriginalIndex.forEach(({ agent, originalIndex }) => {
    const icon = gradeIcons[agent.grade];
    tbody.innerHTML += `
      <tr class="border-b hover:bg-gray-50 text-sm">
        <td class="py-3.5 px-6 font-bold text-gray-900 uppercase">${agent.nom || ''} ${agent.prenom || ''}</td>
        <td class="py-3.5 px-6">
          <div class="flex items-center space-x-2">
            ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain">` : ''}
            <span>${agent.grade || '—'}</span>
          </div>
        </td>
        <td class="py-3.5 px-6 font-mono text-xs">${agent.rio || '—'}</td>
        <td class="py-3.5 px-6">${agent.qualiteJudiciaire || agent.qualif || '—'}</td>
        <td class="py-3.5 px-6">${agent.specialite || '—'}</td>
        <td class="py-3.5 px-6 font-mono text-xs">${agent.phone || '0000000'}</td>
        <td class="py-3.5 px-6">
          <span class="px-2 py-1 rounded text-xs font-bold ${agent.status === 'ACTIF' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
            ${agent.status || 'ACTIF'}
          </span>
        </td>
        <td class="py-3.5 px-6 text-right flex items-center justify-end space-x-3">
          <button type="button" onclick="editOrgAgent(${originalIndex})" class="text-blue-900 hover:text-blue-700 font-bold text-xs uppercase tracking-wider flex items-center space-x-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            <span>ÉDITER</span>
          </button>
          <button type="button" onclick="openOrgDeleteModal(${originalIndex})" class="text-red-600 hover:text-red-800 font-bold text-xs uppercase tracking-wider">SUPPRIMER</button>
        </td>
      </tr>
    `;
  });
}

function setupCustomSelect() {
  const optionsDiv = document.getElementById('dropdown-options');
  if (!optionsDiv) return;
  optionsDiv.innerHTML = '';
  ordreGrades.forEach(g => {
    const div = document.createElement('div');
    div.className = "px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm";
    div.innerText = g;
    div.onclick = () => { 
      document.getElementById('input-grade').value = g; 
      const selectedText = document.getElementById('selected-grade-text');
      if (selectedText) {
        selectedText.innerText = g;
        selectedText.classList.remove('text-gray-500');
      }
      optionsDiv.classList.add('hidden'); 
    };
    optionsDiv.appendChild(div);
  });
}

function toggleDropdown() { 
  const el = document.getElementById('dropdown-options');
  if (el) el.classList.toggle('hidden'); 
}

function handleLogout() { sessionStorage.clear(); window.location.href = '/'; }