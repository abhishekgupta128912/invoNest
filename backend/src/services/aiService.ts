import OpenAI from 'openai';
import { IMessage } from '../models/Chat';

// Initialize OpenAI client (only if API key is available)
let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// System prompt for Indian tax law expertise
const SYSTEM_PROMPT = `You are InvoNest AI, an expert assistant specializing in Indian taxation, GST, TDS, and business compliance. You help MSMEs, freelancers, and gig workers understand Indian tax laws and regulations.

EXPERTISE AREAS:
- Goods and Services Tax (GST) - rates, filing, compliance
- Tax Deducted at Source (TDS) - rates, applicability, filing
- Income Tax - slabs, deductions, filing procedures
- Business compliance - registrations, licenses, documentation
- Invoice generation and GST compliance
- Digital payments and tax implications

GUIDELINES:
1. Provide accurate, up-to-date information based on Indian tax laws
2. Use simple language suitable for small business owners
3. Include relevant sections/rules when applicable
4. Suggest practical solutions and next steps
5. Clarify when professional consultation is recommended
6. Focus on compliance and legal requirements
7. Provide examples relevant to Indian business context

RESPONSE FORMAT:
- Be concise but comprehensive
- Use bullet points for clarity
- Include relevant tax rates and deadlines
- Mention applicable forms and procedures
- Suggest InvoNest features when relevant

Remember: You're helping Indian businesses stay compliant and grow successfully.`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  message: string;
  category: 'gst' | 'tds' | 'income-tax' | 'compliance' | 'general';
  confidence: number;
  suggestedActions?: string[];
  relatedTopics?: string[];
}

/**
 * Categorize user query based on content
 */
export const categorizeQuery = (query: string): 'gst' | 'tds' | 'income-tax' | 'compliance' | 'general' => {
  const lowerQuery = query.toLowerCase();
  
  // GST related keywords
  if (lowerQuery.includes('gst') || lowerQuery.includes('goods and services tax') || 
      lowerQuery.includes('cgst') || lowerQuery.includes('sgst') || lowerQuery.includes('igst') ||
      lowerQuery.includes('tax invoice') || lowerQuery.includes('input credit') ||
      lowerQuery.includes('gstr') || lowerQuery.includes('hsn')) {
    return 'gst';
  }
  
  // TDS related keywords
  if (lowerQuery.includes('tds') || lowerQuery.includes('tax deducted at source') ||
      lowerQuery.includes('tds rate') || lowerQuery.includes('tds return') ||
      lowerQuery.includes('form 16') || lowerQuery.includes('tds certificate')) {
    return 'tds';
  }
  
  // Income Tax related keywords
  if (lowerQuery.includes('income tax') || lowerQuery.includes('itr') ||
      lowerQuery.includes('tax slab') || lowerQuery.includes('deduction') ||
      lowerQuery.includes('80c') || lowerQuery.includes('tax filing') ||
      lowerQuery.includes('advance tax')) {
    return 'income-tax';
  }
  
  // Compliance related keywords
  if (lowerQuery.includes('compliance') || lowerQuery.includes('registration') ||
      lowerQuery.includes('license') || lowerQuery.includes('pan') ||
      lowerQuery.includes('aadhaar') || lowerQuery.includes('msme') ||
      lowerQuery.includes('udyam')) {
    return 'compliance';
  }
  
  return 'general';
};

/**
 * Generate AI response using OpenAI
 */
export const generateAIResponse = async (
  messages: ChatMessage[],
  userQuery: string
): Promise<AIResponse> => {
  try {
    if (!openai) {
      // Return fallback response when OpenAI is not configured
      return {
        message: `I understand you're asking about: "${userQuery}"\n\nI'm currently running in demo mode without AI capabilities. To enable full AI responses, please:\n\n1. Get an OpenAI API key from https://platform.openai.com/\n2. Add it to your .env file: OPENAI_API_KEY=your-key\n3. Restart the server\n\nFor now, here are some helpful resources for Indian tax queries:\n\n• GST Portal: https://www.gst.gov.in/\n• Income Tax e-filing: https://www.incometax.gov.in/\n• TDS information: Check latest rates on IT department website\n\nFeel free to ask more questions - I'll provide basic guidance!`,
        category: categorizeQuery(userQuery),
        confidence: 0.7,
        suggestedActions: [
          'Configure OpenAI API key',
          'Visit official tax websites',
          'Consult a tax professional',
          'Check InvoNest documentation'
        ],
        relatedTopics: [
          'OpenAI API setup',
          'Tax consultation services',
          'Official government resources',
          'InvoNest features'
        ]
      };
    }

    // Prepare conversation history
    const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(-8).map(msg => ({ // Keep last 8 messages for context
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userQuery }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: conversationMessages,
      max_tokens: 1000,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const aiMessage = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';
    
    // Categorize the query
    const category = categorizeQuery(userQuery);
    
    // Calculate confidence based on response length and category match
    const confidence = calculateConfidence(userQuery, aiMessage, category);
    
    // Generate suggested actions and related topics
    const suggestedActions = generateSuggestedActions(category, userQuery);
    const relatedTopics = generateRelatedTopics(category);

    return {
      message: aiMessage,
      category,
      confidence,
      suggestedActions,
      relatedTopics
    };

  } catch (error: any) {
    console.error('AI Service Error:', error);
    
    // Fallback response
    return {
      message: 'I apologize, but I\'m experiencing technical difficulties. Please try again later or contact support for urgent tax queries.',
      category: 'general',
      confidence: 0,
      suggestedActions: ['Contact support', 'Try again later'],
      relatedTopics: []
    };
  }
};

/**
 * Calculate confidence score for the response
 */
const calculateConfidence = (query: string, response: string, category: string): number => {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on response length (more detailed = higher confidence)
  if (response.length > 200) confidence += 0.2;
  if (response.length > 500) confidence += 0.1;
  
  // Increase confidence if category-specific keywords are present in response
  const categoryKeywords = {
    'gst': ['GST', 'CGST', 'SGST', 'IGST', 'tax invoice', 'input credit'],
    'tds': ['TDS', 'tax deducted', 'Form 16', 'TDS rate'],
    'income-tax': ['income tax', 'ITR', 'tax slab', 'deduction'],
    'compliance': ['compliance', 'registration', 'license'],
    'general': []
  };
  
  const keywords = categoryKeywords[category as keyof typeof categoryKeywords] || [];
  const keywordMatches = keywords.filter(keyword => 
    response.toLowerCase().includes(keyword.toLowerCase())
  ).length;
  
  confidence += (keywordMatches * 0.05);
  
  return Math.min(confidence, 1.0);
};

/**
 * Generate suggested actions based on category and query
 */
const generateSuggestedActions = (category: string, query: string): string[] => {
  const actions: { [key: string]: string[] } = {
    'gst': [
      'Create GST-compliant invoice',
      'Check GST rates for your products',
      'File GST return',
      'Calculate input tax credit'
    ],
    'tds': [
      'Download TDS certificate',
      'Check TDS rates',
      'File TDS return',
      'Verify TDS deduction'
    ],
    'income-tax': [
      'Calculate tax liability',
      'File income tax return',
      'Check tax saving options',
      'Plan advance tax payment'
    ],
    'compliance': [
      'Register for GST',
      'Apply for business license',
      'Update business information',
      'Check compliance calendar'
    ],
    'general': [
      'Explore InvoNest features',
      'Contact tax consultant',
      'Read tax guides',
      'Schedule consultation'
    ]
  };
  
  return actions[category] || actions['general'];
};

/**
 * Generate related topics based on category
 */
const generateRelatedTopics = (category: string): string[] => {
  const topics: { [key: string]: string[] } = {
    'gst': [
      'GST registration process',
      'Input tax credit rules',
      'GST return filing',
      'E-invoice requirements'
    ],
    'tds': [
      'TDS rates for different payments',
      'TDS return filing deadlines',
      'TDS certificate download',
      'Lower deduction certificate'
    ],
    'income-tax': [
      'Tax saving investments',
      'Income tax slabs',
      'Advance tax calculation',
      'ITR filing process'
    ],
    'compliance': [
      'Business registration requirements',
      'MSME registration benefits',
      'Digital signature certificate',
      'Compliance calendar'
    ],
    'general': [
      'Tax planning strategies',
      'Business accounting basics',
      'Digital payment compliance',
      'Professional consultation'
    ]
  };
  
  return topics[category] || topics['general'];
};

/**
 * Get quick responses for common queries
 */
export const getQuickResponse = (query: string): string | null => {
  const quickResponses: { [key: string]: string } = {
    'gst rate': 'Standard GST rate in India is 18%. However, rates vary: 0% (essential items), 5% (basic necessities), 12% (standard goods), 18% (most goods/services), 28% (luxury items).',
    'gst registration': 'GST registration is mandatory if annual turnover exceeds ₹40 lakhs (₹20 lakhs for special category states). Register online at GST portal with required documents.',
    'tds rate': 'TDS rates vary by payment type: Salary (as per tax slab), Professional fees (10%), Rent (10%), Interest (10%), Commission (5%). Check latest rates on Income Tax website.',
    'itr filing': 'ITR filing deadline is usually July 31st for individuals. Choose correct ITR form based on income sources. File online through Income Tax e-filing portal.',
    'pan card': 'PAN card is mandatory for all financial transactions above specified limits. Apply online through NSDL/UTIITSL websites with required documents.'
  };
  
  const lowerQuery = query.toLowerCase().trim();
  
  for (const [key, response] of Object.entries(quickResponses)) {
    if (lowerQuery.includes(key)) {
      return response;
    }
  }
  
  return null;
};
