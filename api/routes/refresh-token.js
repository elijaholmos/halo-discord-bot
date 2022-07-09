import express from 'express';

import RefreshToken from '../data/RefreshToken';

const router = express.Router();

router.post('/', async (req, res) => { res.send(RefreshToken); });

export {router as refreshToken};
