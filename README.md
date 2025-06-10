# 🚀 InvoNest - AI-Powered Invoicing & Compliance Platform

**Secure, AI-powered invoicing and compliance platform designed for Indian MSMEs, freelancers, and gig workers.**

## 🌟 Features

- **🧾 GST-Compliant Invoices** - Professional invoice generation with automated Indian tax calculations
- **🤖 AI Tax Assistant** - Instant answers to GST, TDS, and Indian tax law questions
- **📅 Smart Compliance Calendar** - Proactive alerts and reminders for tax deadlines
- **🔐 Secure Authentication** - JWT-based authentication with role-based access control
- **📄 Document Management** - AI-powered document parsing and storage
- **⛓️ Blockchain Integration** - Invoice integrity verification using Polygon Mumbai testnet
- **🌐 Multi-language Support** - Hindi and English support
- **📱 Mobile Responsive** - PWA capabilities for mobile access

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **React** for UI components

### Backend
- **Express.js** with TypeScript
- **MongoDB** with Mongoose
- **JWT** for authentication
- **bcrypt** for password hashing

### AI & Integrations
- **OpenAI API** for tax chatbot
- **jsPDF** for PDF generation
- **Polygon Mumbai** testnet for blockchain

### Deployment
- **Frontend**: Vercel (free tier)
- **Backend**: Render/Railway (free tier)
- **Database**: MongoDB Atlas (512MB free)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd invoNest
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📁 Project Structure

```
invoNest/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # Reusable components
│   │   └── lib/            # Utilities and configurations
│   └── package.json
├── backend/                 # Express.js backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── utils/          # Utility functions
│   │   └── config/         # Configuration files
│   └── package.json
└── README.md
```

## 🔧 Environment Variables

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/invonest
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=7d
OPENAI_API_KEY=your-openai-api-key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
PRIVATE_KEY=your-wallet-private-key
```

## 🎯 Development Roadmap

### ✅ Day 1: Project Setup & Foundation
- [x] Initialize Next.js frontend with TypeScript
- [x] Setup Express.js backend with TypeScript
- [x] Configure MongoDB connection
- [x] Create basic project structure
- [x] Setup development environment

### 🔄 Day 2: Authentication & User Management
- [ ] Implement JWT-based authentication
- [ ] Create user registration/login
- [ ] Setup role-based access control
- [ ] Configure security middleware

### 🔄 Day 3: Invoice Module
- [ ] Build GST-compliant invoice creation
- [ ] Implement PDF generation
- [ ] Create invoice templates
- [ ] Add invoice hash generation

### 🔄 Day 4: AI Chatbot Integration
- [ ] Integrate OpenAI API
- [ ] Configure tax law knowledge base
- [ ] Create chat interface
- [ ] Implement context-aware responses

### ✅ Day 5: Compliance Calendar & Notifications
- [x] Build compliance calendar
- [x] Setup email notifications
- [x] Create alert system
- [x] Implement notification preferences

### ✅ Day 6: File Upload & Blockchain PoC
- [x] Add file upload functionality
- [x] Implement document parsing with AI
- [x] Create blockchain integration (Polygon PoC)
- [x] Setup document management system
- [x] Build drag-and-drop file upload UI
- [x] Implement document security and hash verification

### 🔄 Day 7: Integration & Deployment
- [ ] Connect all modules
- [ ] Setup production environment
- [ ] Deploy to Vercel and Render
- [ ] Configure domain and SSL

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for Indian MSMEs, freelancers, and gig workers
- Inspired by the need for affordable digital tax tools
- Powered by modern web technologies and AI

---

**InvoNest** - Empowering Indian businesses with intelligent invoicing and compliance solutions.
