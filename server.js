const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const compression = require("compression");
const redis = require("redis");
const winston = require("winston");
const { ElasticsearchTransport } = require("winston-elasticsearch");

// Configuración de Redis
const redisClient = redis.createClient();
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

// Configuración de Elasticsearch
const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: 'http://localhost:9200' }
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    esTransport
  ]
});

// Configuración del servidor
const app = express();
app.use(compression());
const server = http.createServer(app);
const io = socketIo(server);

// URLs APIs
const API_ENDPOINTS = {
  BCA_STATS: "http://radioactive.sytes.net:3001/api/v1/BCA/",
  BTC_STATS: "http://radioactive.sytes.net:3001/api/v1/BTC/",
  BCA_SUBMIT: "http://radioactive.sytes.net:1030",
  BTC_SUBMIT: "http://radioactive.sytes.net:1029"
};

// Datos en memoria
let stats = {
  btc: { blocks: 0, shares: 0 },
  bca: { blocks: 0, shares: 0 }
};

// Función de caché con Redis
async function cachedFetch(key, url) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);

  const response = await axios.get(url);
  await redisClient.setEx(key, 15, JSON.stringify(response.data));
  return response.data;
}

// Actualización de estadísticas
async function updateStats() {
  try {
    const [btcData, bcaData] = await Promise.all([
      cachedFetch('btc_stats', API_ENDPOINTS.BTC_STATS),
      cachedFetch('bca_stats', API_ENDPOINTS.BCA_STATS)
    ]);

    stats.btc.blocks = btcData?.blocks || 0;
    stats.bca.blocks = bcaData?.blocks || 0;

    io.emit('stats_update', stats);
    logger.info('Stats updated', { stats });
  } catch (error) {
    logger.error('Error updating stats', { error: error.message });
  }
}

// Envío de shares
async function submitShare(chain, data) {
  try {
    const url = chain === 'BTC' ? API_ENDPOINTS.BTC_SUBMIT : API_ENDPOINTS.BCA_SUBMIT;
    const response = await axios.post(url, data);

    if (response.data.success) {
      stats[chain.toLowerCase()].shares += 1;
      io.emit('stats_update', stats);
      logger.info(`Share submitted to ${chain}`, { data });
    }
  } catch (error) {
    logger.error(`Error submitting to ${chain}`, { error: error.message });
  }
}

// Configurar WebSocket
io.on('connection', (socket) => {
  logger.info('New client connected');
  socket.emit('init_stats', stats);
});

// Programar tareas
setInterval(updateStats, 10000);
setInterval(() => {
  submitShare('BTC', { nonce: Date.now() });
  submitShare('BCA', { nonce: Date.now() });
}, 15000);

// Servir frontend
app.use(express.static('public'));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});
