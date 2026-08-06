require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// Configuration JSONBin.io
const BIN_ID = "6a6bec81f5f4af5e29d80b84";
const MASTER_KEY = "$2a$10$4QakocWzyo.QhFvScjsxXeXgsqEMnDvF4HHcLZtPWgrhRem/QURS.";
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

    // Identifiants des rôles administrateurs Discord
    const ROLE_ARMURERIE = "1521576291722330354";
    const ROLE_COMMANDEMENT = "1521576207299383386";

    const hasAdminRole = userRoles.includes(ROLE_COMMANDEMENT) || userRoles.includes(ROLE_ARMURERIE);

    // Dynamic Check : Interrogation de la base de données JSONBin pour vérifier l'accès individuel (Case Intranet)
    let isAuthorizedInDb = false;
    try {
      const dbResponse = await axios.get(API_URL, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      const organigramme = dbResponse.data.record?.organigramme || [];
      const agent = organigramme.find(a => String(a.discordId) === String(userId));
      
      if (agent && agent.intranetAccess) {
        isAuthorizedInDb = true;
      }
    } catch (dbErr) {
      console.error("Erreur d'accès à la base de données JSONBin lors de l'auth :", dbErr.message);
    }

    // Autorisation accordée si rôle admin Discord OU coché dans l'organigramme
    if (hasAdminRole || isAuthorizedInDb) {
      const rolesParam = encodeURIComponent(JSON.stringify(userRoles));
      return res.redirect(`/index.html?auth=success&discord_id=${userId}&roles=${rolesParam}`);
    } else {
      return res.redirect('/?error=not_authorized');
    }

  } catch (error) {
    console.error('Erreur authentification Discord :', error.response?.data || error.message);
    return res.redirect('/?error=not_in_guild');
  }
});

// 7. Route API pour récupérer les informations d'un membre Discord via son ID (pour le bouton CHARGER)
app.get('/api/discord-user/:id', async (req, res) => {
  const userId = req.params.id;
  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({ success: false, message: "Token du bot non configuré dans le fichier .env" });
  }

  try {
    // Récupération du membre
    const memberResponse = await axios.get(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    // Récupération de tous les rôles du serveur
    const rolesResponse = await axios.get(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    const member = memberResponse.data;
    const allRoles = rolesResponse.data;

    // Association des IDs des rôles du membre avec leurs noms réels
    const userRoleNames = (member.roles || []).map(roleId => {
      const foundRole = allRoles.find(r => r.id === roleId);
      return foundRole ? foundRole.name : null;
    }).filter(Boolean);

    // Récupération du nom d'affichage (surnom sur le serveur, sinon nom global, sinon nom d'utilisateur)
    const displayName = member.nick || member.user.global_name || member.user.username;

    res.json({
      success: true,
      displayName: displayName,
      roles: userRoleNames // Renvoie la liste des NOMS de rôles (ex: ["Capitaine", "OPJ"])
    });
  } catch (error) {
    console.error("Erreur API Discord Bot :", error.response?.data || error.message);
    res.status(404).json({ success: false, message: "Utilisateur introuvable sur le serveur Discord." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});