import express from 'express';
import { gateway, refreshToken, tokenValidate } from './routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/gateway', gateway);
app.use('/refresh-token', refreshToken);
app.use('/token-validate', tokenValidate);

app.listen(3000, () => console.info('API listening on port 3000'));
