// src/db/index.js

import mysql from 'mysql2/promise';
import { DB_NAME } from "../constants.js";

// Create the connection to the MySQL database
const connectDB = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: DB_NAME,  // This is your "crm" database
      connectTimeout: 10000,
    });

    console.log(`\n MySQL connected !! DB HOST: ${process.env.MYSQL_HOST}`);
    
    // Return the connection instance for further queries
    return connection;
  } catch (error) {
    console.error("MySQL connection FAILED ", error.message);
    throw error;
  }
};

export default connectDB;
