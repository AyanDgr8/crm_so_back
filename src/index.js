// src/index.js

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from './app.js';
import 'colors';

dotenv.config({
  path: './.env'
});

let connectionInstance;

const server = app.listen(process.env.PORT, () => {
  console.log(`⚙️  Server is running at port : ${process.env.PORT}`.cyan.bold);
});

process.title = 'MultyComm CRM';

// Graceful shutdown function
const gracefulShutdown = async () => {
  console.log('📢 Received shutdown signal, closing server and database connections...'.yellow.bold);

  if (connectionInstance) {
    await connectionInstance.end();  // Close MySQL connection
    console.log('🔌 MySQL connection closed successfully.'.blue.bold);
  }

  server.close(() => {
    console.log('💤 Server closed successfully.'.blue.bold);
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Connect to MySQL
connectDB()
  .then((connection) => {
    connectionInstance = connection;  // Save the connection instance
    console.log(`🔌 MySQL connected`.green.bold);
  })
  .catch((err) => {
    console.log("MySQL connection failed !!! ".red.bold, err);
    process.exit(1);
  });

