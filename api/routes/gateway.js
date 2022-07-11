import express from 'express';
import { GatewayController } from '../controllers/GatewayController';

const router = express.Router();

router.post('/', async (req, res) => {
	const { operationName, variables={} } = req.body;
	res.send(await GatewayController[operationName](variables));
});

export { router as gateway };
