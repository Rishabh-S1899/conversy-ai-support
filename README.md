# GPT-Powered Customer Support Chat

A production-ready AI customer support system built with Node.js, Express, React, and OpenAI. This application provides automated customer support with human oversight for e-commerce platforms.

## 🚀 Features

### MVP Capabilities
- **Smart Customer Chat Widget**: Order status, returns, refunds, cancellations, and FAQ support
- **RAG-powered Knowledge Base**: Contextual responses using embedded policy documents  
- **LLM Integration**: OpenAI GPT for structured intent classification and response generation
- **Mock Orders Database**: SQLite with seeded sample orders for testing
- **Human-in-the-Loop**: Agent dashboard for reviewing and approving destructive actions
- **Audit Logging**: Complete conversation history with PII masking
- **Metrics & Monitoring**: Bot containment rates and performance tracking

### Technical Features
- **Professional UI**: Clean, trustworthy design using Tailwind CSS and shadcn/ui
- **Real-time Chat**: Responsive chat interface with confidence indicators
- **Structured AI Responses**: JSON-formatted bot responses with intent classification
- **Security**: Environment-based secrets, PII masking, protected endpoints
- **Ready for Deployment**: Auto-deployable on Replit, Cursor, or any Node.js host

## 📋 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key
- Agent password (for access control)

### Setup Instructions

1. **Clone & Install**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   npm install
   ```

2. **Environment Setup**
   
   **For Replit/Cursor:**
   - Go to "Secrets" or "Environment Variables" in your hosting platform
   - Add these secrets:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `AGENT_PASSWORD`: Password for agent/admin access
   
   **For Local Development:**
   ```bash
   export OPENAI_API_KEY="your_openai_api_key_here"
   export AGENT_PASSWORD="your_secure_password"
   ```

3. **Start the Application**
   ```bash
   npm run dev    # Development (includes frontend build)
   # OR
   npm start      # Production
   ```

4. **Access the Application**
   - **Customer Chat**: `http://localhost:3000/`
   - **Agent Dashboard**: `http://localhost:3000/agent`
   - **Audit Logs**: `http://localhost:3000/admin/audit`
   - **Metrics**: `http://localhost:3000/metrics`

### Public URL on Replit/Cursor
After deployment, your hosting platform will provide a public URL like:
- Replit: `https://your-app-name.username.repl.co`
- Cursor: Check the deployment panel for your public URL

## 🧪 Testing with cURL

### 1. Check Order Status
```bash
curl -X GET "http://localhost:3000/api/orders/ORD-1001"
```

### 2. Send Chat Message
```bash
curl -X POST "http://localhost:3000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Where is my order ORD-1001?",
    "order_id": "ORD-1001",
    "user_email": "alice@example.com"
  }'
```

### 3. Create Action Escalation
```bash
curl -X POST "http://localhost:3000/api/escalate" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-123",
    "order_id": "ORD-1001",
    "action": {
      "type": "cancel_order",
      "order_id": "ORD-1001",
      "reason": "customer requested"
    }
  }'
```

### 4. Get Metrics
```bash
curl -X GET "http://localhost:3000/metrics"
```

## 📊 Sample Data

The system comes pre-seeded with 8 sample orders:

| Order ID | Customer | Status | Items | Tracking |
|----------|----------|---------|-------|----------|
| ORD-1001 | alice@example.com | placed | T-Shirt Red | - |
| ORD-1002 | bob@example.com | shipped | Mug Blue (2x) | TN-12345 |
| ORD-1003 | carol@example.com | delivered | Hoodie Black | TN-12346 |
| ORD-1004 | david@example.com | placed | Shoes White | - |
| ORD-1005 | eve@example.com | shipped | Jacket Navy | TN-12347 |
| ORD-1006 | frank@example.com | delivered | Hat Red (2x) | TN-12348 |
| ORD-1007 | grace@example.com | placed | Dress Blue | - |
| ORD-1008 | henry@example.com | delivered | Pants Black (2x) | TN-12349 |

## 🔧 Architecture

### Backend API Endpoints
- `POST /api/chat` - Process customer messages with AI
- `GET /api/orders/:orderId` - Retrieve order information
- `POST /api/escalate` - Create action escalation for agent review
- `GET /api/agent/pending` - List pending escalations (requires auth)
- `POST /api/agent/approve` - Approve/reject escalated actions (requires auth)
- `GET /admin/audit` - View conversation audit logs (requires auth)
- `GET /metrics` - System performance metrics

### AI & RAG System
- **Knowledge Base**: 6 policy documents covering shipping, returns, refunds
- **Embeddings**: OpenAI `text-embedding-3-small` for semantic search
- **LLM**: GPT-4 for structured intent classification and response generation
- **Fallback**: Text-based search when embeddings unavailable

### Database Schema
- **orders**: Order management with status tracking
- **conversations**: Complete chat history with PII masking
- **escalations**: Actions requiring human approval
- **returns**: Return request tracking

### Security Features
- Environment-based API key storage
- PII masking in audit logs (`alice@example.com` → `a***e@example.com`)
- Password-protected admin endpoints
- No real payment data storage

## 🔍 Key Files

```
├── server.js              # Express backend with all API endpoints
├── src/
│   ├── components/
│   │   ├── ChatWidget.tsx     # Main customer chat interface
│   │   ├── ChatMessage.tsx    # Individual message component
│   │   └── AgentDashboard.tsx # Agent approval interface
│   ├── pages/
│   │   ├── Index.tsx          # Main customer page
│   │   ├── AgentPage.tsx      # Agent dashboard page
│   │   └── AuditPage.tsx      # Audit logs viewer
├── data/
│   ├── kb.json           # Knowledge base articles (auto-created)
│   └── kb-index.json     # Embeddings cache (auto-generated)
└── db/
    └── support.db        # SQLite database (auto-created)
```

## 🚨 Important Notes

### Environment Variables Required:
- `OPENAI_API_KEY`: Get from OpenAI dashboard
- `AGENT_PASSWORD`: Choose a secure password for admin access

### Without OpenAI API Key:
- The system will run in fallback mode
- Chat responses will be generic but functional
- Knowledge base search will use text matching
- All other features work normally

### Production Considerations:
- Enable HTTPS in production
- Use proper database backups
- Monitor API usage and costs
- Implement rate limiting for production use
- Consider encrypted audit log storage

## 🎯 Usage Scenarios

1. **Customer Checks Order**: "Where is order ORD-1001?" → Bot looks up order and provides status
2. **Return Request**: "I want to return my order" → Bot collects details, creates escalation for agent
3. **Policy Questions**: "What's your return policy?" → Bot searches knowledge base, provides policy info
4. **Cancellation**: "Cancel my order" → Bot checks if cancellable, escalates to agent if needed
5. **Agent Review**: Agent sees escalation, reviews context, approves/rejects action

## 🛠️ Customization

- **Knowledge Base**: Edit `data/kb.json` to update policies
- **Styling**: Modify `src/index.css` and Tailwind config for branding  
- **AI Prompts**: Adjust system prompts in `server.js` for different behaviors
- **Sample Data**: Update seed data in `server.js` for your products

## 📞 Support

For technical issues or customization needs, check:
1. Browser console for client-side errors
2. Server logs for backend issues  
3. `/metrics` endpoint for system health
4. `/admin/audit` for conversation debugging

---

**Ready to deploy!** This system is production-ready and can handle real customer support scenarios with proper monitoring and OpenAI API limits.