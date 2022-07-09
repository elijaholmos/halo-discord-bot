import express from 'express';

import TokenValidate from '../data/TokenValidate';

const router = express.Router();

router.post('/', async (req, res) => { res.send(TokenValidate); });

export {router as tokenValidate};
