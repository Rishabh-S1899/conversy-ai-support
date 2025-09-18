const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Database = require('sqlite3').verbose();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize database
const initDb = () => {
  const dbPath = path.join(__dirname, 'db', 'support.db');
  
  // Create db directory if it doesn't exist
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  
  const db = new Database(dbPath);
  
  // Create tables
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('placed', 'shipped', 'delivered')),
        items_json TEXT NOT NULL,
        tracking_number TEXT,
        created_at DATETIME NOT NULL,
        refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'requested', 'processing', 'completed'))
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        masked_user_email TEXT,
        messages TEXT NOT NULL,
        llm_response_json TEXT,
        action_suggested TEXT,
        agent_decision TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        order_id TEXT,
        action_type TEXT NOT NULL,
        action_payload TEXT NOT NULL,
        conversation_context TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'processing', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
      )
    `);

    // Check if we need to seed data
    db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
      if (err) {
        console.error('Error checking order count:', err);
        return;
      }
      
      if (row.count === 0) {
        const seedOrders = [
          ['ORD-1001', 'alice@example.com', 'placed', JSON.stringify([{"sku":"TSHIRT-RED","qty":1,"price":29.99}]), null, '2025-09-01T10:00:00Z', 'none'],
          ['ORD-1002', 'bob@example.com', 'shipped', JSON.stringify([{"sku":"MUG-BLUE","qty":2,"price":15.99}]), 'TN-12345', '2025-08-28T09:00:00Z', 'none'],
          ['ORD-1003', 'carol@example.com', 'delivered', JSON.stringify([{"sku":"HOODIE-BLACK","qty":1,"price":49.99}]), 'TN-12346', '2025-08-20T14:30:00Z', 'none'],
          ['ORD-1004', 'david@example.com', 'placed', JSON.stringify([{"sku":"SHOES-WHITE","qty":1,"price":89.99}]), null, '2025-09-15T11:15:00Z', 'none'],
          ['ORD-1005', 'eve@example.com', 'shipped', JSON.stringify([{"sku":"JACKET-NAVY","qty":1,"price":79.99}]), 'TN-12347', '2025-09-10T16:45:00Z', 'requested'],
          ['ORD-1006', 'frank@example.com', 'delivered', JSON.stringify([{"sku":"HAT-RED","qty":2,"price":19.99}]), 'TN-12348', '2025-08-15T08:20:00Z', 'completed'],
          ['ORD-1007', 'grace@example.com', 'placed', JSON.stringify([{"sku":"DRESS-BLUE","qty":1,"price":69.99}]), null, '2025-09-16T13:10:00Z', 'none'],
          ['ORD-1008', 'henry@example.com', 'delivered', JSON.stringify([{"sku":"PANTS-BLACK","qty":2,"price":39.99}]), 'TN-12349', '2025-08-25T10:30:00Z', 'none']
        ];
        
        const stmt = db.prepare(`
          INSERT INTO orders (order_id, user_email, status, items_json, tracking_number, created_at, refund_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        seedOrders.forEach(orderData => {
          stmt.run(orderData, (err) => {
            if (err) console.error('Error seeding order:', err);
          });
        });
        
        stmt.finalize();
        console.log('Database seeded with sample orders');
      }
    });
  });
  
  return db;
};

// Initialize database
const db = initDb();

// Initialize OpenAI and RAG system
let openai = null;
let kbIndex = null;

const initOpenAI = async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY not set. AI features will be disabled.');
    return;
  }
  
  const { OpenAI } = require('openai');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  // Initialize knowledge base
  await initKnowledgeBase();
};

const initKnowledgeBase = async () => {
  const kbPath = path.join(__dirname, 'data', 'kb.json');
  const kbIndexPath = path.join(__dirname, 'data', 'kb-index.json');
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(path.dirname(kbPath))) {
    fs.mkdirSync(path.dirname(kbPath), { recursive: true });
  }
  
  // Create knowledge base if it doesn't exist
  if (!fs.existsSync(kbPath)) {
    const kb = [
      {
        id: "shipping-policy",
        title: "Shipping Policy",
        content: "We offer free standard shipping on orders over $50. Standard shipping takes 3-5 business days. Express shipping (1-2 business days) costs $9.99. We ship Monday-Friday, excluding holidays."
      },
      {
        id: "return-policy", 
        title: "Return Policy",
        content: "Items can be returned within 30 days of delivery for a full refund. Items must be unused and in original packaging. Return shipping is free for defective items, $5.99 for other returns."
      },
      {
        id: "refund-policy",
        title: "Refund Policy", 
        content: "Refunds are processed within 3-5 business days after we receive your return. Refunds go back to the original payment method. Shipping charges are non-refundable unless the item was defective."
      },
      {
        id: "order-cancellation",
        title: "Order Cancellation",
        content: "Orders can be cancelled for free if they haven't shipped yet. Once an order has shipped, it cannot be cancelled but can be returned after delivery following our return policy."
      },
      {
        id: "tracking-info",
        title: "Order Tracking",
        content: "You'll receive a tracking number via email once your order ships. You can track your package on our website or the carrier's website. Delivery confirmation is available upon request."
      },
      {
        id: "size-exchanges",
        title: "Size Exchanges", 
        content: "Free size exchanges are available within 30 days. The original item must be returned in new condition. We'll send the new size once we receive the return."
      }
    ];
    
    fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2));
  }
  
  // Load and index knowledge base
  const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
  
  if (fs.existsSync(kbIndexPath)) {
    kbIndex = JSON.parse(fs.readFileSync(kbIndexPath, 'utf8'));
  } else if (openai) {
    // Generate embeddings for KB
    console.log('Generating embeddings for knowledge base...');
    kbIndex = [];
    
    for (const item of kb) {
      try {
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: `${item.title}: ${item.content}`
        });
        
        kbIndex.push({
          ...item,
          embedding: embedding.data[0].embedding
        });
      } catch (error) {
        console.error(`Error generating embedding for ${item.id}:`, error.message);
        kbIndex.push({ ...item, embedding: null });
      }
    }
    
    fs.writeFileSync(kbIndexPath, JSON.stringify(kbIndex, null, 2));
    console.log('Knowledge base indexed successfully');
  } else {
    // Fallback without embeddings
    kbIndex = kb.map(item => ({ ...item, embedding: null }));
  }
};

// Utility functions
const maskEmail = (email) => {
  if (!email) return '';
  const [username, domain] = email.split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  return `${username[0]}***${username[username.length - 1]}@${domain}`;
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const searchKnowledgeBase = async (query) => {
  if (!kbIndex) return [];
  
  if (openai && kbIndex[0]?.embedding) {
    try {
      // Use embedding similarity
      const queryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });
      
      const similarities = kbIndex.map(item => ({
        ...item,
        similarity: item.embedding ? cosineSimilarity(queryEmbedding.data[0].embedding, item.embedding) : 0
      }));
      
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
    } catch (error) {
      console.error('Embedding search failed, falling back to text search:', error.message);
    }
  }
  
  // Fallback to simple text search
  const queryLower = query.toLowerCase();
  const matches = kbIndex
    .map(item => ({
      ...item,
      relevance: (item.title.toLowerCase().includes(queryLower) ? 2 : 0) +
                 (item.content.toLowerCase().includes(queryLower) ? 1 : 0)
    }))
    .filter(item => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3);
    
  return matches;
};

// API Routes

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, order_id, user_email, session_id } = req.body;
  const actualSessionId = session_id || uuidv4();
  
  try {
    // Search knowledge base
    const kbMatches = await searchKnowledgeBase(message);
    
    // Get order info if order_id provided
    let orderInfo = null;
    if (order_id) {
      const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id);
      if (order) {
        orderInfo = {
          ...order,
          items: JSON.parse(order.items_json)
        };
      }
    }
    
    if (!openai) {
      // Fallback response without OpenAI
      const response = {
        intent: 'fallback',
        confidence: 0.5,
        response_text: 'I apologize, but our AI system is currently unavailable. Please contact our human support team for assistance.',
        actions: [{ type: 'none' }],
        kb_matches: kbMatches
      };
      
      // Log conversation
      db.run(`
        INSERT INTO conversations (session_id, masked_user_email, messages, llm_response_json)
        VALUES (?, ?, ?, ?)
      `, [
        actualSessionId,
        maskEmail(user_email),
        JSON.stringify([{ role: 'user', content: message }]),
        JSON.stringify(response)
      ], (err) => {
        if (err) {
          console.error('Error logging conversation:', err);
        }
      });
      
      return res.json(response);
    }
    
    // Build context for LLM
    let contextPrompt = `You are a helpful customer support assistant for an e-commerce platform. Your role is to help customers with order status, returns, refunds, cancellations, and general FAQs.

IMPORTANT: You must respond with valid JSON only. Do not include any text before or after the JSON.

Available Knowledge Base:
${kbMatches.map((match, i) => `${i + 1}. ${match.title}: ${match.content}`).join('\n')}`;
    
    if (orderInfo) {
      contextPrompt += `\n\nOrder Information:
Order ID: ${orderInfo.order_id}
Status: ${orderInfo.status}
Items: ${orderInfo.items.map(item => `${item.sku} (qty: ${item.qty})`).join(', ')}
Tracking: ${orderInfo.tracking_number || 'Not available yet'}
Created: ${orderInfo.created_at}
Refund Status: ${orderInfo.refund_status}`;
    }
    
    contextPrompt += `\n\nRespond with JSON in this exact format:
{
  "intent": "<detected_intent>",
  "confidence": 0.0-1.0,
  "response_text": "<helpful_response>",
  "actions": [{"type": "none"} or {"type": "cancel_order", "order_id": "...", "reason": "..."} or {"type": "request_return", "order_id": "...", "reason": "..."} or {"type": "check_refund", "order_id": "..."}]
}

Rules:
- Always cite KB sources when using policy information
- Never fabricate tracking numbers or delivery dates
- If information is missing, ask clarifying questions
- Only suggest actions for valid requests with proper order info
- Destructive actions (cancel, return, refund) require explicit customer confirmation`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: contextPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
    });
    
    let llmResponse;
    try {
      llmResponse = JSON.parse(completion.choices[0].message.content);
      llmResponse.kb_matches = kbMatches;
    } catch (error) {
      console.error('Failed to parse LLM response as JSON:', error);
      llmResponse = {
        intent: 'parse_error',
        confidence: 0.1,
        response_text: 'I apologize, but I encountered an issue processing your request. Could you please rephrase your question?',
        actions: [{ type: 'none' }],
        kb_matches: kbMatches
      };
    }
    
    // Log conversation
    db.run(`
      INSERT INTO conversations (session_id, masked_user_email, messages, llm_response_json, action_suggested)
      VALUES (?, ?, ?, ?, ?)
    `, [
      actualSessionId,
      maskEmail(user_email),
      JSON.stringify([{ role: 'user', content: message }]),
      JSON.stringify(llmResponse),
      JSON.stringify(llmResponse.actions)
    ], (err) => {
      if (err) {
        console.error('Error logging conversation:', err);
      }
    });
    
    res.json(llmResponse);
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      intent: 'error',
      confidence: 0,
      response_text: 'I apologize, but I encountered an error. Please try again or contact support.',
      actions: [{ type: 'none' }]
    });
  }
});

// Get order endpoint
app.get('/api/orders/:orderId', (req, res) => {
  try {
    db.get('SELECT * FROM orders WHERE order_id = ?', [req.params.orderId], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({
        ...row,
        items: JSON.parse(row.items_json)
      });
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create escalation endpoint
app.post('/api/escalate', (req, res) => {
  const { session_id, order_id, action, conversation_context } = req.body;
  
  try {
    db.run(`
      INSERT INTO escalations (session_id, order_id, action_type, action_payload, conversation_context)
      VALUES (?, ?, ?, ?, ?)
    `, [
      session_id,
      order_id,
      action.type,
      JSON.stringify(action),
      JSON.stringify(conversation_context || [])
    ], function(err) {
      if (err) {
        console.error('Escalation error:', err);
        return res.status(500).json({ error: 'Failed to create escalation' });
      }
      
      res.json({ 
        escalation_id: this.lastID,
        status: 'pending',
        message: 'Your request has been escalated to our support team for review.'
      });
    });
  } catch (error) {
    console.error('Escalation error:', error);
    res.status(500).json({ error: 'Failed to create escalation' });
  }
});

// Agent endpoints
app.get('/api/agent/pending', (req, res) => {
  const password = req.headers.authorization?.replace('Bearer ', '');
  
  if (password !== process.env.AGENT_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    db.all(`
      SELECT * FROM escalations 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `, (err, rows) => {
      if (err) {
        console.error('Get pending escalations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const escalations = rows.map(escalation => ({
        ...escalation,
        action_payload: JSON.parse(escalation.action_payload),
        conversation_context: JSON.parse(escalation.conversation_context)
      }));
      
      res.json(escalations);
    });
  } catch (error) {
    console.error('Get pending escalations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/agent/approve', (req, res) => {
  const password = req.headers.authorization?.replace('Bearer ', '');
  
  if (password !== process.env.AGENT_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { escalation_id, action, agent_notes } = req.body;
  
  try {
    // Get escalation
    db.get('SELECT * FROM escalations WHERE id = ?', [escalation_id], (err, escalation) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!escalation) {
        return res.status(404).json({ error: 'Escalation not found' });
      }
      
      const actionPayload = JSON.parse(escalation.action_payload);
      
      // Execute the action
      let result = {};
      
      if (actionPayload.type === 'cancel_order') {
        // Check if order can be cancelled
        db.get('SELECT * FROM orders WHERE order_id = ?', [escalation.order_id], (err, order) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          if (!order) {
            return res.status(404).json({ error: 'Order not found' });
          }
          
          if (order.status === 'shipped' || order.status === 'delivered') {
            return res.status(400).json({ error: 'Cannot cancel shipped or delivered orders' });
          }
          
          // Update order status
          db.run('UPDATE orders SET status = ? WHERE order_id = ?', ['cancelled', escalation.order_id], (err) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            
            result = { message: `Order ${escalation.order_id} has been cancelled` };
            updateEscalationStatus();
          });
        });
        
      } else if (actionPayload.type === 'request_return') {
        // Create return record
        db.run(`
          INSERT INTO returns (order_id, reason, status)
          VALUES (?, ?, ?)
        `, [escalation.order_id, actionPayload.reason, 'approved'], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          result = { message: `Return request approved for order ${escalation.order_id}` };
          updateEscalationStatus();
        });
        
      } else if (actionPayload.type === 'process_refund') {
        // Update refund status
        db.run('UPDATE orders SET refund_status = ? WHERE order_id = ?', ['processing', escalation.order_id], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          result = { message: `Refund processing initiated for order ${escalation.order_id}` };
          updateEscalationStatus();
        });
      } else {
        updateEscalationStatus();
      }
      
      function updateEscalationStatus() {
        // Update escalation status
        db.run(`
          UPDATE escalations 
          SET status = ?, resolved_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [action === 'approve' ? 'approved' : 'rejected', escalation_id], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          // Log agent decision
          db.run(`
            UPDATE conversations 
            SET agent_decision = ? 
            WHERE session_id = ?
          `, [
            JSON.stringify({ action, agent_notes, result }),
            escalation.session_id
          ], (err) => {
            if (err) {
              console.error('Database error:', err);
            }
            
            res.json({ success: true, result });
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Agent approval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Audit endpoint
app.get('/admin/audit', (req, res) => {
  const password = req.query.password;
  
  if (password !== process.env.AGENT_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    db.all(`
      SELECT * FROM conversations 
      ORDER BY created_at DESC 
      LIMIT 50
    `, (err, rows) => {
      if (err) {
        console.error('Audit error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const logs = rows.map(log => ({
        ...log,
        messages: JSON.parse(log.messages),
        llm_response_json: log.llm_response_json ? JSON.parse(log.llm_response_json) : null,
        action_suggested: log.action_suggested ? JSON.parse(log.action_suggested) : null,
        agent_decision: log.agent_decision ? JSON.parse(log.agent_decision) : null
      }));
      
      res.json(logs);
    });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    db.get('SELECT COUNT(*) as count FROM conversations', (err, totalChats) => {
      if (err) {
        console.error('Metrics error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      db.get('SELECT COUNT(*) as count FROM escalations', (err2, totalEscalations) => {
        if (err2) {
          console.error('Metrics error:', err2);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        db.get('SELECT COUNT(*) as count FROM conversations WHERE agent_decision IS NULL', (err3, resolvedByBot) => {
          if (err3) {
            console.error('Metrics error:', err3);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          const botContainmentRate = totalChats.count > 0 ? (resolvedByBot.count / totalChats.count) : 0;
          
          res.json({
            total_chats: totalChats.count,
            total_escalations: totalEscalations.count,
            bot_containment_estimate: botContainmentRate
          });
        });
      });
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
const startServer = async () => {
  await initOpenAI();
  
  app.listen(PORT, () => {
    console.log(`🚀 Customer Support Server running on port ${PORT}`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`🔧 Agent UI: http://localhost:${PORT}/agent`);
    console.log(`📋 Audit Logs: http://localhost:${PORT}/admin/audit`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  Set OPENAI_API_KEY environment variable to enable AI features');
    }
    if (!process.env.AGENT_PASSWORD) {
      console.log('⚠️  Set AGENT_PASSWORD environment variable to secure agent access');
    }
  });
};

startServer().catch(console.error);