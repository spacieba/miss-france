'use strict';
// Serveur local de développement : `npm run dev` (lit le fichier .env)
const express = require('express');
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
const server = express();
server.use(express.static(app.staticDir));
server.use(app);
server.listen(PORT, () => console.log(`🎉 Miss France en local sur http://localhost:${PORT}`));
