import { ZodError } from 'zod';
import { HttpError } from './types.js';
export function notFound(_req, res) {
    res.status(404).json({ error: 'NOT_FOUND' });
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
    }
    if (err instanceof ZodError) {
        res.status(422).json({ error: 'VALIDATION_ERROR', details: err.flatten() });
        return;
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
}
