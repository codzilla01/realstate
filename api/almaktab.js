import { waitUntil } from '@vercel/functions';
import { createVercelHandler } from '../vercel-handler.mjs';

export default createVercelHandler({ defer: waitUntil });
