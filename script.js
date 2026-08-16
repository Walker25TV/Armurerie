// ==================== RECUPERATION DES INFORMATIONS DISCORD ET UTILS ====================
const urlParamsScript = new URLSearchParams(window.location.search);

// Valeurs par défaut configurées avec tes informations (évite le retour à "INCONNU / Gardien")
const rawNom = urlParamsScript.get('nom') || sessionStorage.getItem('discord_nom') || sessionStorage.getItem('user_nom') || "WALKER";
const rawPrenom = urlParamsScript.get('prenom') || sessionStorage.getItem('discord_prenom') || sessionStorage.getItem('user_prenom') || "Chris";
const formattedNom = rawNom.toUpperCase();
const formattedPrenom = rawPrenom.charAt(0).toUpperCase() + rawPrenom.slice(1).toLowerCase();
const fullNameFormatted = `${formattedNom} ${formattedPrenom}`;

const dynamicGrade = urlParamsScript.get('grade') || sessionStorage.getItem('discord_grade') || sessionStorage.getItem('user_grade') || "Capitaine-Stagiaire";
const dynamicQualif = urlParamsScript.get('qualification') || sessionStorage.getItem('discord_qualif') || sessionStorage.getItem('user_qualif') || "Officier de Police Judiciaire";
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

// ==================== NAVIGATION DES VUES ====================
function switchView(viewName) {
  const views = ['accueil', 'organigramme', 'armurerie-container', 'commandement'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const activeBtnClass = ['bg-blue-900', 'text-white'];
  const inactiveBtnClass = ['text-gray-700', 'hover:bg-gray-100'];
  ['accueil', 'organigramme', 'armurerie', 'commandement'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (btn) {
      btn.classList.remove(...activeBtnClass);
      btn.classList.add(...inactiveBtnClass);
    }
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  const targetBtn = document.getElementById(`nav-${viewName}`);
  if (targetBtn) {
    targetBtn.classList.remove(...inactiveBtnClass);
    targetBtn.classList.add(...activeBtnClass);
  }

  if (viewName === 'armurerie-container') {
    showArmurerieOverview();
  }
}

// ==================== API & SAUVEGARDE (JSONBIN) ====================
async function loadData() {
  try {
    const res = await fetch(API_URL, {
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    if (!res.ok) throw new Error("Erreur de chargement");
    const json = await res.json();
    if (json.record) {
      dbData = json.record;
      if (!dbData.armurerie) {
        dbData.armurerie = { 'PIE X26': [], 'SIG SP 2022': [], 'LBD 40': [], 'HK UMP 9': [], 'HK G36': [] };
      }
      if (!dbData.organigramme) dbData.organigramme = [];
    }
    updateArmurerieCounts();
    renderOrganigrammeTable();
  } catch (e) {
    console.error("Erreur API :", e);
  }
}

async function saveData() {
  try {
    await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(dbData)
    });
  } catch (e) {
    console.error("Erreur de sauvegarde :", e);
  }
}

// ==================== GESTION DE L'ARMURERIE ====================
function updateArmurerieCounts() {
  let grandTotal = 0;
  for (const weapon in dbData.armurerie) {
    const count = dbData.armurerie[weapon].length;
    grandTotal += count;
    const countElement = document.getElementById(`count-${weapon}`);
    if (countElement) {
      countElement.innerText = count;
    }
  }
  const badge = document.getElementById('total-weapons-badge');
  if (badge) {
    badge.innerText = `${grandTotal} arme${grandTotal > 1 ? 's' : ''} enregistrée${grandTotal > 1 ? 's' : ''} au total`;
  }
}

function showArmurerieOverview() {
  document.getElementById('sub-view-armurerie').classList.remove('hidden');
  document.getElementById('sub-view-details').classList.add('hidden');
}

function showDetails(weaponName) {
  currentWeapon = weaponName;
  const breadcrumb = document.getElementById('breadcrumb-weapon-name');
  const title = document.getElementById('title-weapon-name');
  if (breadcrumb) breadcrumb.innerText = weaponName;
  if (title) title.innerText = weaponName;

  renderWeaponTable();

  document.getElementById('sub-view-armurerie').classList.add('hidden');
  document.getElementById('sub-view-details').classList.remove('hidden');
}

function renderWeaponTable() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const items = dbData.armurerie[currentWeapon] || [];

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 px-6 text-center text-gray-500">Aucun effectif assigné à cette arme.</td></tr>`;
  } else {
    items.forEach((item, index) => {
      const icon = gradeIcons[item.grade];
      const row = `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="py-3.5 px-6 font-semibold">
            <div class="flex items-center space-x-2">
              ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain" alt="">` : ''}
              <span>${item.grade}</span>
            </div>
          </td>
          <td class="py-3.5 px-6 uppercase">${item.nom}</td>
          <td class="py-3.5 px-6 capitalize">${item.prenom}</td>
          <td class="py-3.5 px-6 font-mono text-xs text-blue-900 font-bold">${item.serie}</td>
          <td class="py-3.5 px-6 text-right">
            <button onclick="openDeleteModal(${index})" class="text-red-600 hover:text-red-800 text-xs font-bold uppercase tracking-wider">
              Supprimer
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  }
}

function handleAddAgent(event) {
  event.preventDefault();

  const grade = document.getElementById('input-grade').value;
  const nom = document.getElementById('input-nom').value.trim();
  const prenom = document.getElementById('input-prenom').value.trim();
  const serie = document.getElementById('input-serie').value.trim();

  if (!grade || !nom || !prenom || !serie) return;

  if (!dbData.armurerie[currentWeapon]) {
    dbData.armurerie[currentWeapon] = [];
  }

  dbData.armurerie[currentWeapon].push({ grade, nom, prenom, serie });
  document.getElementById('add-agent-form').reset();

  const selectText = document.getElementById('selected-grade-text');
  if (selectText) selectText.innerText = "Sélectionner un grade";
  document.getElementById('input-grade').value = "";

  saveData();
  renderWeaponTable();
  updateArmurerieCounts();
}

function openDeleteModal(index) {
  indexToDelete = index;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  indexToDelete = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

// ==================== ORGANIGRAMME & ACCÈS INTRANET ====================
function openAddAgentModal() {
  document.getElementById('add-agent-modal').classList.remove('hidden');
}

function closeAddAgentModal() {
  document.getElementById('add-agent-modal').classList.add('hidden');
  document.getElementById('modal-add-org-agent-form').reset();
  tempDiscordAgent = null;
  document.getElementById('modal-preview-name').innerText = '—';
  document.getElementById('modal-preview-grade').innerText = '—';
  document.getElementById('modal-preview-qualif').innerText = '—';
  document.getElementById('modal-preview-service').innerText = '—';
}

async function fetchDiscordData() {
  const id = document.getElementById('modal-input-discord').value.trim();
  if (!id) return alert("Veuillez saisir un ID Discord valide.");

  try {
    const res = await fetch(`/api/discord-user/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert("Impossible de trouver cet utilisateur sur le serveur Discord.");
      return;
    }

    let cleanedName = data.displayName.replace(/\[.*?\]/g, '').trim();
    const nameParts = cleanedName.split(/\s+/);
    
    const nom = nameParts[0] ? nameParts[0].toUpperCase() : "INCONNU";
    const prenom = nameParts.slice(1).join(' ') || "Agent";

    const userRoles = (data.roles || []).map(r => r.toString());

    let detectedGrade = "Gardien de la Paix";
    
    for (const gradeOption of ordreGrades) {
      const normalizedOption = gradeOption.toLowerCase().replace(/[-_]/g, ' ').trim();
      
      const match = userRoles.some(role => {
        // Nettoyage des symboles Discord (| et ➖) pour permettre la correspondance exacte avec "Capitaine-Stagiaire"
        const normalizedRole = role.toLowerCase().replace(/[|–—\-_]/g, ' ').replace(/\s+/g, ' ').trim();
        return normalizedRole.includes(normalizedOption);
      });

      if (match) {
        detectedGrade = gradeOption;
        break;
      }
    }

    let detectedQualif = "Agent de Police Judiciaire";
    if (userRoles.some(r => /OPJ|Officier de Police Judiciaire/i.test(r))) {
      detectedQualif = "Officier de Police Judiciaire";
    } else if (userRoles.some(r => /APJ\s*73|APJ73/i.test(r))) {
      detectedQualif = "APJ Article 73";
    }

    let detectedService = "Générale";
    const servicesList = ["CRS", "BAC", "CSI", "PS", "PJ", "RAID", "BRI", "GSP", "USL"];

    for (const srv of servicesList) {
      const regex = new RegExp(`\\b${srv}\\b`, 'i');
      if (userRoles.some(r => regex.test(r))) {
        detectedService = srv;
        break;
      }
    }

    tempDiscordAgent = {
      discordId: id,
      nom: nom,
      prenom: prenom,
      grade: detectedGrade,
      qualification: detectedQualif,
      specialite: detectedService
    };

    document.getElementById('modal-preview-name').innerText = `${tempDiscordAgent.prenom} ${tempDiscordAgent.nom}`;
    document.getElementById('modal-preview-grade').innerText = tempDiscordAgent.grade;
    document.getElementById('modal-preview-qualif').innerText = tempDiscordAgent.qualification;
    document.getElementById('modal-preview-service').innerText = tempDiscordAgent.specialite;

  } catch (err) {
    console.error("Erreur lors de la récupération des données Discord :", err);
    alert("Erreur lors de la communication avec le serveur.");
  }
}

function handleModalAddOrgAgent(e) {
  e.preventDefault();
  const rio = document.getElementById('modal-input-rio').value.trim();
  const statut = document.getElementById('modal-input-statut').value;
  const phone = document.getElementById('modal-input-phone').value.trim();
  const intranetAccess = document.getElementById('modal-input-intranet').checked;
  const discordId = document.getElementById('modal-input-discord').value.trim();

  const newAgent = {
    discordId: tempDiscordAgent ? tempDiscordAgent.discordId : discordId,
    nom: tempDiscordAgent ? tempDiscordAgent.nom : "INCONNU",
    prenom: tempDiscordAgent ? tempDiscordAgent.prenom : "Agent",
    grade: tempDiscordAgent ? tempDiscordAgent.grade : "Gardien de la Paix",
    qualification: tempDiscordAgent ? tempDiscordAgent.qualification : "APJ",
    specialite: tempDiscordAgent ? tempDiscordAgent.specialite : "Générale",
    rio: rio,
    statut: statut,
    phone: phone,
    intranetAccess: intranetAccess
  };

  dbData.organigramme.push(newAgent);
  saveData();
  renderOrganigrammeTable();
  closeAddAgentModal();
}

function renderOrganigrammeTable() {
  const tbody = document.getElementById('org-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const totalCountEl = document.getElementById('org-total-count');
  if (totalCountEl) totalCountEl.innerText = dbData.organigramme.length;

  dbData.organigramme.forEach((agent, index) => {
    const icon = gradeIcons[agent.grade];
    const tr = document.createElement('tr');
    tr.className = "hover:bg-gray-50 transition-colors";
    tr.innerHTML = `
      <td class="py-3 px-6 font-bold text-gray-900">${agent.prenom} ${agent.nom}</td>
      <td class="py-3 px-6 text-blue-900 font-extrabold">
        <div class="flex items-center space-x-2">
          ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain" alt="${agent.grade}">` : ''}
          <span>${agent.grade}</span>
        </div>
      </td>
      <td class="py-3 px-6 font-mono text-xs">${agent.rio}</td>
      <td class="py-3 px-6 text-gray-600">${agent.qualification}</td>
      <td class="py-3 px-6 text-gray-600">${agent.specialite}</td>
      <td class="py-3 px-6 font-mono text-xs">${agent.phone}</td>
      <td class="py-3 px-6">
        <span class="px-2 py-1 text-[10px] font-bold rounded ${agent.statut === 'ACTIF' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${agent.statut}
        </span>
        ${agent.intranetAccess ? '<span class="ml-1 px-2 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-800">INTRANET</span>' : ''}
      </td>
      <td class="py-3 px-6 text-right">
        <button onclick="openOrgDeleteModal(${index})" class="text-red-600 hover:text-red-800 text-xs font-bold uppercase tracking-wider">Supprimer</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openOrgDeleteModal(index) {
  orgIndexToDelete = index;
  document.getElementById('org-delete-modal').classList.remove('hidden');
}

function closeOrgDeleteModal() {
  orgIndexToDelete = null;
  document.getElementById('org-delete-modal').classList.add('hidden');
}

const orgConfirmBtn = document.getElementById('org-confirm-delete-btn');
if (orgConfirmBtn) {
  orgConfirmBtn.addEventListener('click', () => {
    if (orgIndexToDelete !== null) {
      dbData.organigramme.splice(orgIndexToDelete, 1);
      saveData();
      renderOrganigrammeTable();
      closeOrgDeleteModal();
    }
  });
}

// ==================== DROPDOWN / LOGOUT ====================
function setupCustomSelect() {
  const optionsDiv = document.getElementById('dropdown-options');
  if (!optionsDiv) return;
  optionsDiv.innerHTML = '';
  ordreGrades.forEach(g => {
    const icon = gradeIcons[g];
    const div = document.createElement('div');
    div.className = "px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 flex items-center space-x-2";
    div.innerHTML = `
      ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain flex-shrink-0" alt="">` : ''}
      <span>${g}</span>
    `;
    div.onclick = () => {
      const selectedContainer = document.getElementById('selected-grade-text');
      if (selectedContainer) {
        selectedContainer.innerHTML = `
          <div class="flex items-center space-x-2">
            ${icon ? `<img src="${icon}" class="w-5 h-5 object-contain" alt="">` : ''}
            <span>${g}</span>
          </div>
        `;
      }
      document.getElementById('input-grade').value = g;
      optionsDiv.classList.add('hidden');
    };
    optionsDiv.appendChild(div);
  });
}

function toggleDropdown() {
  const optionsDiv = document.getElementById('dropdown-options');
  if (optionsDiv) optionsDiv.classList.toggle('hidden');
}

function handleLogout() {
  sessionStorage.clear();
  window.location.href = '/';
}