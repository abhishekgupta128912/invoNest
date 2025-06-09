import { Request, Response } from 'express';
import Chat, { IChat } from '../models/Chat';
import { generateAIResponse, getQuickResponse, categorizeQuery } from '../services/aiService';

// Create new chat session
export const createChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { title, category } = req.body;

    // Generate session ID
    const sessionId = (Chat as any).generateSessionId();

    // Create new chat session
    const chat = new Chat({
      userId,
      sessionId,
      title: title || 'New Chat',
      category: category || 'general',
      messages: []
    });

    await chat.save();

    res.status(201).json({
      success: true,
      message: 'Chat session created successfully',
      data: {
        sessionId: chat.sessionId,
        title: chat.title,
        category: chat.category,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Create chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Send message and get AI response
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!message || message.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
      return;
    }

    // Find chat session
    const chat = await Chat.findOne({ sessionId, userId });
    if (!chat) {
      res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
      return;
    }

    // Add user message
    await chat.addMessage({
      role: 'user',
      content: message.trim()
    });

    // Check for quick response first
    const quickResponse = getQuickResponse(message);
    let aiResponse;

    if (quickResponse) {
      // Use quick response
      aiResponse = {
        message: quickResponse,
        category: categorizeQuery(message),
        confidence: 0.9,
        suggestedActions: [],
        relatedTopics: []
      };
    } else {
      // Generate AI response
      const recentMessages = chat.getRecentMessages(8);
      aiResponse = await generateAIResponse(recentMessages, message);
    }

    // Add AI response to chat
    await chat.addMessage({
      role: 'assistant',
      content: aiResponse.message
    });

    // Update chat category if it's more specific
    if (chat.category === 'general' && aiResponse.category !== 'general') {
      chat.category = aiResponse.category;
      await chat.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        userMessage: {
          role: 'user',
          content: message,
          timestamp: new Date()
        },
        aiResponse: {
          role: 'assistant',
          content: aiResponse.message,
          timestamp: new Date(),
          category: aiResponse.category,
          confidence: aiResponse.confidence,
          suggestedActions: aiResponse.suggestedActions,
          relatedTopics: aiResponse.relatedTopics
        }
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get chat history
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const chat = await Chat.findOne({ sessionId, userId });
    if (!chat) {
      res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Chat history retrieved successfully',
      data: {
        sessionId: chat.sessionId,
        title: chat.title,
        category: chat.category,
        messages: chat.messages,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all chat sessions for user
export const getChatSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 20, category } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Build query
    const query: any = { userId, isActive: true };
    if (category && category !== 'all') {
      query.category = category;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [chats, total] = await Promise.all([
      Chat.find(query)
        .select('sessionId title category lastActivity createdAt messages')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Chat.countDocuments(query)
    ]);

    // Add message count and last message preview
    const chatsWithPreview = chats.map(chat => ({
      sessionId: chat.sessionId,
      title: chat.title,
      category: chat.category,
      messageCount: chat.messages?.length || 0,
      lastMessage: chat.messages?.length > 0 ? 
        chat.messages[chat.messages.length - 1].content.substring(0, 100) + 
        (chat.messages[chat.messages.length - 1].content.length > 100 ? '...' : '') : 
        null,
      lastActivity: chat.lastActivity,
      createdAt: chat.createdAt
    }));

    res.status(200).json({
      success: true,
      message: 'Chat sessions retrieved successfully',
      data: {
        chats: chatsWithPreview,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get chat sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update chat session (title, category)
export const updateChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { sessionId } = req.params;
    const { title, category } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const chat = await Chat.findOne({ sessionId, userId });
    if (!chat) {
      res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
      return;
    }

    // Update fields
    if (title) chat.title = title;
    if (category) chat.category = category;

    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Chat session updated successfully',
      data: {
        sessionId: chat.sessionId,
        title: chat.title,
        category: chat.category
      }
    });

  } catch (error) {
    console.error('Update chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete chat session
export const deleteChatSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const chat = await Chat.findOne({ sessionId, userId });
    if (!chat) {
      res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
      return;
    }

    // Soft delete by marking as inactive
    chat.isActive = false;
    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Chat session deleted successfully'
    });

  } catch (error) {
    console.error('Delete chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get suggested questions for getting started
export const getSuggestedQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    const suggestions: { [key: string]: string[] } = {
      'gst': [
        'What is the current GST rate for my product?',
        'How do I register for GST?',
        'What is input tax credit and how to claim it?',
        'When should I file GST returns?',
        'What documents are required for GST registration?'
      ],
      'tds': [
        'What is the TDS rate for professional services?',
        'How to download TDS certificate online?',
        'When is TDS applicable on rent payments?',
        'What is the penalty for late TDS filing?',
        'How to get lower deduction certificate?'
      ],
      'income-tax': [
        'What are the current income tax slabs?',
        'How to save tax under Section 80C?',
        'When is the deadline for ITR filing?',
        'What is advance tax and when to pay?',
        'Which ITR form should I use?'
      ],
      'compliance': [
        'What licenses do I need for my business?',
        'How to register for MSME benefits?',
        'What is the process for PAN card application?',
        'Do I need digital signature for my business?',
        'What are the compliance requirements for startups?'
      ],
      'general': [
        'How can InvoNest help my business?',
        'What are the benefits of GST registration?',
        'How to maintain proper business records?',
        'What are the tax implications of digital payments?',
        'How to plan taxes for my small business?'
      ]
    };

    const categoryKey = (category as string) || 'general';
    const questions = suggestions[categoryKey] || suggestions['general'];

    res.status(200).json({
      success: true,
      message: 'Suggested questions retrieved successfully',
      data: {
        category: categoryKey,
        questions
      }
    });

  } catch (error) {
    console.error('Get suggested questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
