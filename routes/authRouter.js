import express from 'express';
import { signin, signout, signup } from '../controllers/auth.js';
import { verify } from 'jsonwebtoken';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/signout', signout);
router.post('/verify', verify);

export default router;