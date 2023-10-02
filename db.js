import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

export const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
});

db.connect(() => {
    console.log('Connected to db!');
})