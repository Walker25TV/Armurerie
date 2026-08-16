require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// Configuration JSONBin.io (avec fallback sur vos clés actuelles)
const BIN_ID = process.env.JSONBIN_BIN_ID || "6a6bec81f5f4af5e29d80b84";
const MASTER_KEY = process.env.JSONBIN_MASTER_KEY || "$2a$10$4QakocWzyo.QhFvScjsxXeXgsqEMnDvF4HHcLZtPWgrhRem/QURS.";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// 1. Désactiver la mise en cache pour forcer le navigateur à actualiser les pages
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// 2. Route explicite pour la racine : envoie obligatoirement le login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// 3. Route pour lancer la connexion Discord
app.get('/auth/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=identify+guilds+guilds.members.read`;
  res.redirect(discordAuthUrl);
});

// 4. Route de protection pour l'intranet (index.html)
app.get('/index.html', (req, res) => {
  if (req.query.auth !== 'success') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. Servir les fichiers statiques (images, css, js) sans exposer les pages de structure
app.use(express.static(__dirname, { index: false }));

// 6. Route de callback Discord (Vérification Rôles Discord + Habilitation Intranet Organigramme)
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.redirect('/login.html?error=no_code');

  try {
    // Échange du code contre le token d'accès Discord
    const tokenParams = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.REDIRECT_URI,
    });

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // Récupération du profil membre dans le serveur Discord (Guild)
    const memberResponse = await axios.get(
      `https://discord.com/api/v10/users/@me/guilds/${process.env.GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const userId = memberResponse.data.user.id;
    const userRoles = memberResponse.data.roles || [];

    // Extraction du Nom / Surnom Discord de l'utilisateur
    const userDisplayName = memberResponse.data.nick || memberResponse.data.user.global_name || memberResponse.data.user.username;

    // Identifiants des rôles autorisés sur l'intranet
    const ROLE_POLICE_NATIONALE = "1521576237493915789";
    const ROLE_COMMANDEMENT = "1521576207299383386";

    // Seuls les membres Police Nationale ou Commandement sont autorisés par rôle
    const hasAdminRole = userRoles.includes(ROLE_POLICE_NATIONALE) || userRoles.includes(ROLE_COMMANDEMENT);

    // Dynamic Check : Interrogation de la base de données JSONBin
    let isAuthorizedInDb = false;
    try {
      const dbResponse = await axios.get(API_URL, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });

      const recordData = typeof dbResponse.data.record === 'string' 
        ? JSON.parse(dbResponse.data.record) 
        : dbResponse.data.record;

      const organigramme = recordData?.organigramme || [];
      const agent = organigramme.find(a => String(a.discordId) === String(userId));
      
      if (agent && agent.intranetAccess) {
        isAuthorizedInDb = true;
      }
    } catch (dbErr) {
      console.error("Erreur d'accès à la base de données JSONBin lors de l'auth :", dbErr.message);
    }

    if (hasAdminRole || isAuthorizedInDb) {
      const rolesParam = encodeURIComponent(JSON.stringify(userRoles));
      const pseudoParam = encodeURIComponent(userDisplayName);

      // Redirection incluant le pseudo pour éviter le fallback "INCONNU Agent"
      return res.redirect(`/index.html?auth=success&discord_id=${userId}&pseudo=${pseudoParam}&roles=${rolesParam}`);
    } else {
      return res.redirect('/?error=not_authorized');
    }

  } catch (error) {
    console.error('Erreur authentification Discord :', error.response?.data || error.message);
    return res.redirect('/?error=not_in_guild');
  }
});

// 7. Route API pour récupérer un membre Discord et parser son profil (Grade, Spé, QJ, Nom)
app.get('/api/discord-user/:id', async (req, res) => {
  const userId = req.params.id.trim();
  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({ success: false, message: "Token du bot non configuré." });
  }

  const authHeader = { Authorization: `Bot ${botToken.trim()}` };

  try {
    let memberData = null;
    let userRoleIds = [];
    let userRoleNames = [];

    // Étape 1 : Tenter de récupérer le membre directement sur le serveur (Guild)
    try {
      const memberResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${userId}`,
        { headers: authHeader }
      );
      memberData = memberResponse.data;
      userRoleIds = memberData.roles || [];

      // Récupération et association des rôles du serveur
      const rolesResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`,
        { headers: authHeader }
      );
      const allRoles = rolesResponse.data;

      userRoleNames = userRoleIds.map(roleId => {
        const foundRole = allRoles.find(r => r.id === roleId);
        return foundRole ? foundRole.name : null;
      }).filter(Boolean);

    } catch (guildErr) {
      console.warn("Échec de la recherche membre sur la Guild :", guildErr.response?.data || guildErr.message);
    }

    // Étape 2 : Fallback sur l'utilisateur global Discord si non trouvé dans la guilde
    if (!memberData) {
      const userResponse = await axios.get(
        `https://discord.com/api/v10/users/${userId}`,
        { headers: authHeader }
      );
      memberData = { user: userResponse.data };
    }

    // Nom d'affichage brut
    const rawDisplayName = memberData.nick || memberData.user.global_name || memberData.user.username;

    // 1. Extraction Prénom & Nom RP
    const cleanName = rawDisplayName.replace(/\[.*?\]/g, '').trim() || rawDisplayName;

    // 2. Détection du Grade depuis les rôles Discord (insensible aux majuscules/espaces)
    const GRADELIST = [
      "Elève Gardien de la Paix", "Gardien de la Paix", "Sous-Brigadier", 
      "Brigadier", "Brigadier-Chef", "Major", "Major REX", 
      "Lieutenant", "Capitaine", "Commandant", "Commissaire"
    ];
    let grade = userRoleNames.find(r => 
      GRADELIST.some(g => g.toLowerCase() === r.trim().toLowerCase())
    ) || "Non défini";

    // Fallback Grade si non trouvé dans les rôles mais présent dans le pseudo
    if (grade === "Non défini") {
      const upperName = rawDisplayName.toUpperCase();
      if (upperName.includes("S/B")) grade = "Sous-Brigadier";
      else if (upperName.includes("GDK") || upperName.includes("GPX")) grade = "Gardien de la Paix";
      else if (upperName.includes("BRG") || upperName.includes("BRIGADIER")) grade = "Brigadier";
      else if (upperName.includes("BC") || upperName.includes("BRIGADIER-CHEF")) grade = "Brigadier-Chef";
      else if (upperName.includes("MJR") || upperName.includes("MAJOR")) grade = "Major";
      else if (upperName.includes("LTN") || upperName.includes("LIEUTENANT")) grade = "Lieutenant";
      else if (upperName.includes("CPT") || upperName.includes("CAPITAINE")) grade = "Capitaine";
      else if (upperName.includes("CDT") || upperName.includes("COMMANDANT")) grade = "Commandant";
    }

    // 3. Détection de la Qualité Judiciaire (QJ)
    const QJ_LIST = ["OPJ", "APJ", "APJA"];
    
    // Recherche par rôle Discord
    let qualiteJudiciaire = userRoleNames.find(r => {
      const upperRole = r.toUpperCase().trim();
      return QJ_LIST.includes(upperRole) || 
             upperRole.includes("OFFICIER DE POLICE JUDICIAIRE") || 
             upperRole.includes("AGENT DE POLICE JUDICIAIRE");
    });

    if (qualiteJudiciaire) {
      const upperQJ = qualiteJudiciaire.toUpperCase();
      if (upperQJ.includes("OPJ") || upperQJ.includes("OFFICIER DE POLICE JUDICIAIRE")) qualiteJudiciaire = "OPJ";
      else if (upperQJ.includes("APJA")) qualiteJudiciaire = "APJA";
      else if (upperQJ.includes("APJ")) qualiteJudiciaire = "APJ";
    } else {
      // Recherche par texte dans le nom d'affichage brut
      const upperName = rawDisplayName.toUpperCase();
      if (upperName.includes("OPJ")) qualiteJudiciaire = "OPJ";
      else if (upperName.includes("APJA")) qualiteJudiciaire = "APJA";
      else if (upperName.includes("APJ")) qualiteJudiciaire = "APJ";
    }

    // Fallback automatique selon le grade si aucune QJ n'a été détectée
    if (!qualiteJudiciaire || qualiteJudiciaire === "Aucune") {
      const upperGrade = grade.toUpperCase();
      if (
        upperGrade.includes("CAPITAINE") || 
        upperGrade.includes("LIEUTENANT") || 
        upperGrade.includes("COMMANDANT") || 
        upperGrade.includes("COMMISSAIRE") || 
        upperGrade.includes("MAJOR")
      ) {
        qualiteJudiciaire = "OPJ";
      } else if (
        upperGrade.includes("BRIGADIER") || 
        upperGrade.includes("GARDIEN")
      ) {
        qualiteJudiciaire = "APJ";
      } else if (upperGrade.includes("ELÈVE") || upperGrade.includes("ELEVE")) {
        qualiteJudiciaire = "APJA";
      } else {
        qualiteJudiciaire = "Aucune";
      }
    }

    // 4. Détection de la Spécialité (Hiérarchie : Responsable/Chef > Adjoint > Formateur > Membre)
    let specialite = "Aucune";
    const fullText = (rawDisplayName + " " + userRoleNames.join(" ")).toUpperCase();

    // Détection de la fonction/poste
    let prefixe = "";
    if (fullText.includes("RESPONSABLE") || fullText.includes("RESP")) {
      prefixe = "Responsable";
    } else if (fullText.includes("CHEF DE") || fullText.includes("CHEF")) {
      prefixe = "Chef";
    } else if (fullText.includes("ADJOINT")) {
      prefixe = "Adjoint";
    } else if (fullText.includes("FORMATEUR") || fullText.includes("FTSI")) {
      prefixe = "Formateur";
    }

    // Association de la fonction avec la spécialité
    const UNITS = [
      { key: "CRS", label: "CRS" },
      { key: "BAC", label: "BAC" },
      { key: "GSP", label: "GSP" },
      { key: "BRI", label: "BRI" },
      { key: "RAID", label: "RAID" },
      { key: "PJ", label: "PJ" },
      { key: "BRR", label: "BRR" },
      { key: "USL", label: "USL" },
      { key: "SI", label: "SI" }
    ];

    const detectedUnit = UNITS.find(unit => fullText.includes(unit.key));

    if (detectedUnit) {
      specialite = prefixe ? `${prefixe} ${detectedUnit.label}` : detectedUnit.label;
    } else {
      // Fallback : Extraction du dernier crochet [...] avec nettoyage
      const speMatches = [...rawDisplayName.matchAll(/\[(.*?)\]/g)];
      if (speMatches.length > 0) {
        let extracted = speMatches[speMatches.length - 1][1]
          .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .replace(/[|:-]/g, '')
          .trim();
        specialite = extracted || "Aucune";
      }
    }

    return res.json({
      success: true,
      displayName: cleanName,
      rawDisplayName: rawDisplayName,
      username: memberData.user.username,
      grade: grade,
      qualiteJudiciaire: qualiteJudiciaire,
      specialite: specialite,
      roles: userRoleIds,
      roleNames: userRoleNames
    });

  } catch (error) {
    console.error("Erreur API Discord Bot :", error.response?.data || error.message);
    return res.status(404).json({ success: false, message: "Utilisateur introuvable sur Discord." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});