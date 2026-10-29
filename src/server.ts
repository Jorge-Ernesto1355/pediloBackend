import 'reflect-metadata';

import 'dotenv/config';
import './instrument.js';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
