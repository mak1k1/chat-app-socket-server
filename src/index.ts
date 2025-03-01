import 'dotenv/config';
import express from 'express';
import { initializeWebSocketServer } from './websocket/server';
import { createServer } from 'http';
import path from 'path';

const app = express();
const server = createServer(app);

initializeWebSocketServer(server);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

server.listen(4000, () => {
  console.log('Server is running on port 4000');
});