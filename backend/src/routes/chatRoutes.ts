import express from 'express';
import {
  createChatSession,
  sendMessage,
  getChatHistory,
  getChatSessions,
  updateChatSession,
  deleteChatSession,
  getSuggestedQuestions
} from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { validateChatMessage } from '../middleware/chatValidation';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Chat session management
router.post('/sessions', createChatSession);
router.get('/sessions', getChatSessions);
router.get('/sessions/:sessionId', getChatHistory);
router.put('/sessions/:sessionId', updateChatSession);
router.delete('/sessions/:sessionId', deleteChatSession);

// Message handling
router.post('/sessions/:sessionId/messages', validateChatMessage, sendMessage);

// Utility routes
router.get('/suggestions', getSuggestedQuestions);

export default router;
