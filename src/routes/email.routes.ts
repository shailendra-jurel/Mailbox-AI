// src/routes/email.routes.ts

import { Router } from 'express';
import emailController from '../controllers/email.controller';

const router = Router();

// Email routes
router.get('/', emailController.getEmails);
router.get('/counts', emailController.getEmailCountsByCategory);
router.get('/:id', emailController.getEmailById);
router.put('/:id/category', emailController.updateEmailCategory);
router.get('/:id/suggest-reply', emailController.generateSuggestedReply);

export default router;

