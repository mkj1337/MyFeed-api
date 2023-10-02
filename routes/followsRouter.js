import express from 'express';
import { sendFollow, unFollow, getFollow, getFollowers } from '../controllers/follows.js';

const router = express.Router();

router.post('/:username', sendFollow);
router.post('/unfollow/:username', unFollow);
router.post('/get/:username', getFollow);
router.get('/followers/:followerUsername', getFollowers);

export default router;