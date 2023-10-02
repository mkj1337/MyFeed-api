import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';
import cloud from './cloud.js';


// Routers
import authRouter from './routes/authRouter.js';
import postRouter from './routes/postsRouter.js';
import commentsRouter from './routes/commentsRouter.js';
import usersRouter from './routes/usersRouter.js';
import likesRouter from './routes/likesRouter.js';
import followsRouter from './routes/followsRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(({
    path: path.resolve(__dirname, './.env')
}));

const app = express();
const server = http.createServer(app);


// Middlewares
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://www.devdomain.site');
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization");
    res.header("Access-Control-Allow-Credential", true);
    res.header('Content-Type', 'multipart/form-data');
    next();
});
app.use(cors({
    origin: "https://www.devdomain.site",
    credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.json());

// Routers
app.use('/api/auth', authRouter);
app.use('/api/posts', postRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/likes', likesRouter);
app.use('/api/follows', followsRouter);

server.listen(process.env.PORT || 5500, () => {
    console.log(`Listening on port ${process.env.PORT}`);
})