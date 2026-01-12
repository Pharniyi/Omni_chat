'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  thumbnail?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'contact'
  content: string
  timestamp: Date
  senderId?: string
  senderName?: string
  attachments?: FileAttachment[]
}

interface Contact {
  id: string
  name: string
  email: string
  avatar?: string
  isOnline?: boolean
}

interface Group {
  id: string
  name: string
  members: string[] // Contact IDs
  avatar?: string
  createdAt: Date
}

interface Chat {
  id: string
  type: 'bot' | 'contact' | 'group'
  title: string
  contactId?: string
  groupId?: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  lastMessage?: string
  unreadCount?: number
}

const getInitialMessage = (): Message => ({
  id: '1',
  role: 'assistant',
  content: 'Hello! I\'m OmniChat, your AI assistant. I can help you with employee management, recruitment, accounting, and e-invoicing. How can I assist you today?',
  timestamp: new Date(),
})

const defaultContacts: Contact[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', isOnline: true },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', isOnline: false },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', isOnline: true },
  { id: '4', name: 'Sarah Williams', email: 'sarah@example.com', isOnline: false },
]

// Utility function to extract YouTube video ID from URL
const extractYouTubeVideoId = (text: string): string | null => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = text.match(youtubeRegex)
  return match ? match[1] : null
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [contacts, setContacts] = useState<Contact[]>(defaultContacts)
  const [groups, setGroups] = useState<Group[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([getInitialMessage()])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [userName, setUserName] = useState<string>('User')
  const [userEmail, setUserEmail] = useState<string>('user@example.com')
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'groups'>('chats')
  const [showOverlay, setShowOverlay] = useState<'contacts' | 'groups' | null>(null)
  const [showChatList, setShowChatList] = useState(false)
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups' | 'archived'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedContactsForGroup, setSelectedContactsForGroup] = useState<string[]>([])
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [documentContent, setDocumentContent] = useState<string>('')
  const [isParsingDocument, setIsParsingDocument] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter();

  // Load chats, contacts, groups and user info from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('omnichat-chats')
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats).map((chat: any) => ({
          ...chat,
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
        }))
        setChats(parsedChats)
        if (parsedChats.length > 0) {
          setCurrentChatId(parsedChats[0].id)
          setMessages(parsedChats[0].messages)
        }
      } catch (error) {
        console.error('Error loading chats:', error)
      }
    }

    const savedContacts = localStorage.getItem('omnichat-contacts')
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts))
      } catch (error) {
        console.error('Error loading contacts:', error)
      }
    }

    const savedGroups = localStorage.getItem('omnichat-groups')
    if (savedGroups) {
      try {
        const parsedGroups = JSON.parse(savedGroups).map((group: any) => ({
          ...group,
          createdAt: new Date(group.createdAt),
        }))
        setGroups(parsedGroups)
      } catch (error) {
        console.error('Error loading groups:', error)
      }
    }

    // Load user info
    const savedName = localStorage.getItem('omnichat-user-name')
    const savedEmail = localStorage.getItem('omnichat-user-email')
    if (savedName) setUserName(savedName)
    if (savedEmail) setUserEmail(savedEmail)
  }, [])

  // Save chats, contacts, and groups to localStorage
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('omnichat-chats', JSON.stringify(chats))
    }
  }, [chats])

  useEffect(() => {
    localStorage.setItem('omnichat-contacts', JSON.stringify(contacts))
  }, [contacts])

  useEffect(() => {
    if (groups.length > 0) {
      localStorage.setItem('omnichat-groups', JSON.stringify(groups))
    }
  }, [groups])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateChatTitle = (firstMessage: string): string => {
    const trimmed = firstMessage.trim()
    if (trimmed.length > 50) {
      return trimmed.substring(0, 50) + '...'
    }
    return trimmed || 'New Chat'
  }

  const updateChatInList = (chatId: string, updatedMessages: Message[]) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: updatedMessages,
            updatedAt: new Date(),
            title: updatedMessages.length > 1 && updatedMessages[1].role === 'user'
              ? generateChatTitle(updatedMessages[1].content)
              : chat.title,
          }
        }
        return chat
      })
      return updatedChats
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      // Check if it's a document (PDF or TXT)
      const isDocument = file.type === 'application/pdf' ||
        file.type === 'text/plain' ||
        file.name.endsWith('.txt') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')

      if (isDocument) {
        // Parse document and extract text
        setIsParsingDocument(true)
        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/parse-document', {
            method: 'POST',
            body: formData
          })

          if (response.ok) {
            const data = await response.json()
            setDocumentContent(data.text)
            console.log(`Extracted ${data.length} characters from ${data.fileName}`)

            // Show document as attachment
            const attachment: FileAttachment = {
              id: Date.now().toString() + Math.random(),
              name: file.name,
              type: file.type,
              size: file.size,
              url: URL.createObjectURL(file),
            }
            setAttachments((prev) => [...prev, attachment])
          } else {
            console.error('Failed to parse document')
            alert('Failed to parse document. Please try again.')
          }
        } catch (error) {
          console.error('Error parsing document:', error)
          alert('Error parsing document. Please try again.')
        } finally {
          setIsParsingDocument(false)
        }
      } else {
        // Handle images normally
        const reader = new FileReader()
        reader.onload = (event) => {
          const result = event.target?.result as string
          const attachment: FileAttachment = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            type: file.type,
            size: file.size,
            url: result,
            thumbnail: file.type.startsWith('image/') ? result : undefined,
          }
          setAttachments((prev) => [...prev, attachment])
        }
        reader.readAsDataURL(file)
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id))
  }

  const downloadInvoicePDF = () => {
    // Create HTML content for invoice
    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .invoice-title { font-size: 32px; font-weight: bold; color: #16a34a; margin-bottom: 10px; }
    .invoice-number { font-size: 14px; color: #666; }
    .section { margin-bottom: 30px; }
    .bill-to { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { background: #16a34a; color: white; padding: 12px; text-align: left; }
    .table td { padding: 12px; border-bottom: 1px solid #ddd; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="invoice-title">INVOICE</div>
    <div class="invoice-number">Invoice #: INV-${Date.now()}</div>
  </div>
  
  <div class="section">
    <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
    <div><strong>Due Date:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
  </div>
  
  <div class="section bill-to">
    <strong>BILL TO:</strong><br>
    ${userName}<br>
    ${userEmail}
  </div>
  
  <table class="table">
    <thead>
      <tr>
        <th>DESCRIPTION</th>
        <th>QTY</th>
        <th>RATE</th>
        <th>AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Services</td>
        <td>1</td>
        <td>$1,000.00</td>
        <td>$1,000.00</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align: right;">SUBTOTAL:</td>
        <td>$1,000.00</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align: right;">TAX:</td>
        <td>$0.00</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align: right;">TOTAL:</td>
        <td>$1,000.00</td>
      </tr>
    </tbody>
  </table>
  
  <div class="section">
    <strong>Payment Terms:</strong> Net 30<br>
    <strong>Payment Methods:</strong> Bank Transfer, Credit Card, Check
  </div>
  
  <div class="footer">
    Thank you for your business!<br>
    OmniChat Invoice System
  </div>
</body>
</html>
    `

    // Create a blob and download
    const blob = new Blob([invoiceHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invoice-${Date.now()}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || isLoading) return

    const currentChat = chats.find(c => c.id === currentChatId)
    const userInput = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: currentChat?.type === 'group' ? 'contact' : 'user',
      content: userInput || (attachments.length > 0 ? 'Sent attachment' : ''),
      timestamp: new Date(),
      senderId: 'me',
      senderName: userName,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setAttachments([]) // Clear attachments after sending
    // Create new chat if this is the first user message or no current chat
    let activeChatId = currentChatId
    if (!currentChatId || (messages.length === 1 && messages[0].role === 'assistant')) {
      const newChat: Chat = {
        id: Date.now().toString(),
        type: 'bot',
        title: generateChatTitle(userInput),
        messages: updatedMessages,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      activeChatId = newChat.id
      setCurrentChatId(newChat.id)
      setChats((prev) => [newChat, ...prev])
    } else if (activeChatId) {
      updateChatInList(activeChatId, updatedMessages)
    }

    // For bot chats, generate AI response
    if (currentChat?.type === 'bot' || !currentChat) {
      setIsLoading(true)
      setStreamingContent('')

      // Generate AI response
      try {
        // Cancel previous request if exists
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        const abortController = new AbortController()
        abortControllerRef.current = abortController

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: updatedMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              content: m.content
            })),
            documentContent: documentContent || undefined
          }),
          signal: abortController.signal,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to fetch response')
        }

        const fullResponse = data.response

        // Display response immediately without slow typing simulation
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        }
        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)
        setStreamingContent('')
        setIsLoading(false)
        setDocumentContent('') // Clear document content after sending
        abortControllerRef.current = null

        if (activeChatId) {
          updateChatInList(activeChatId, finalMessages)
        }

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Fetch aborted')
          // Optional: Add a "Request cancelled" message or just leave it
        } else {
          console.error('Error getting AI response:', error)
          setIsLoading(false)
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Error: ${error.message || 'Failed to connect to AI service. Please check the console for details.'}`,
            timestamp: new Date(),
          }
          setMessages([...updatedMessages, errorMessage])
        }
        abortControllerRef.current = null
      }
    } else {
      // For contact/group chats, simulate response after delay
      setIsLoading(true)
      setTimeout(() => {
        const contact = currentChat.type === 'contact'
          ? contacts.find(c => c.id === currentChat.contactId)
          : null
        const group = currentChat.type === 'group'
          ? groups.find(g => g.id === currentChat.groupId)
          : null
        const responderName = contact?.name || group?.name || 'Contact'
        const responseMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'contact',
          content: `Thanks for your message! This is a simulated response from ${responderName}.`,
          timestamp: new Date(),
          senderId: currentChat.contactId || currentChat.groupId || 'other',
          senderName: responderName,
        }
        const finalMessages = [...updatedMessages, responseMessage]
        setMessages(finalMessages)
        setIsLoading(false)
        if (activeChatId) {
          updateChatInList(activeChatId, finalMessages)
        }
      }, 1000)
    }
  }

  const generateResponse = (userInput: string): string => {
    return "" /*
    const lowerInput = userInput.toLowerCase()
    const words = lowerInput.split(/\s+/)

    // Employee Management Responses
    if (lowerInput.includes('employee') || lowerInput.includes('staff') || lowerInput.includes('team') || lowerInput.includes('hr') || lowerInput.includes('human resource')) {
      if (lowerInput.includes('onboard') || lowerInput.includes('new employee') || lowerInput.includes('hiring process')) {
        return `Employee onboarding is crucial for setting new hires up for success. Here's a comprehensive approach:

**Key Steps:**
1. **Pre-boarding** (Before Day 1): Send welcome package, complete paperwork, set up accounts and access
2. **First Day**: Office tour, introductions, company culture overview, equipment setup
3. **First Week**: Training sessions, role-specific orientation, buddy assignment
4. **First Month**: Regular check-ins, goal setting, feedback sessions

**Best Practices:**
- Create a structured 30-60-90 day plan
- Assign a mentor or buddy
- Provide clear documentation and resources
- Schedule regular check-ins
- Gather feedback to improve the process

Would you like me to help you create a specific onboarding checklist or answer questions about any particular aspect?`
      }
      if (lowerInput.includes('performance') || lowerInput.includes('review') || lowerInput.includes('evaluation') || lowerInput.includes('appraisal')) {
        return `Performance reviews are essential for employee development and organizational growth. Here's how to conduct effective reviews:

**Types of Performance Reviews:**
- Annual reviews: Comprehensive yearly assessment
- Quarterly reviews: More frequent check-ins
- 360-degree feedback: Multi-source evaluation
- Continuous feedback: Real-time performance discussions

**Key Components:**
1. **Goal Achievement**: Review set objectives and outcomes
2. **Skills Assessment**: Technical and soft skills evaluation
3. **Behavioral Feedback**: Work ethic, collaboration, communication
4. **Development Plan**: Areas for growth and training needs
5. **Career Pathing**: Discuss future opportunities

**Best Practices:**
- Be specific with examples
- Balance positive feedback with constructive criticism
- Set SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
- Document everything
- Follow up regularly

What specific aspect of performance management would you like to explore?`
      }
      if (lowerInput.includes('leave') || lowerInput.includes('vacation') || lowerInput.includes('pto') || lowerInput.includes('time off') || lowerInput.includes('sick')) {
        return `Managing employee leave effectively is important for both compliance and employee satisfaction:

**Types of Leave:**
- **Paid Time Off (PTO)**: Combined vacation and sick leave
- **Sick Leave**: Medical absences
- **Vacation**: Personal time off
- **Personal Days**: Flexible leave options
- **FMLA**: Family and Medical Leave Act (US)
- **Maternity/Paternity Leave**: Parental time off

**Best Practices:**
- Maintain clear leave policies
- Use leave management software
- Require advance notice when possible
- Track leave balances accurately
- Ensure fair distribution
- Comply with local labor laws

**Common Policies:**
- Accrual vs. lump sum allocation
- Carryover limits
- Blackout dates for busy periods
- Approval workflows

Would you like help creating a leave policy or setting up a leave management system?`
      }
      return `I'd be happy to help with employee management! This is a broad area covering many important aspects:

**Key Areas I Can Assist With:**
- **Onboarding**: Setting up new employees for success
- **Performance Management**: Reviews, evaluations, and goal setting
- **Leave Management**: Vacation, sick leave, and time-off policies
- **Employee Records**: Documentation and data management
- **HR Policies**: Creating and updating company policies
- **Employee Relations**: Conflict resolution and engagement
- **Compensation & Benefits**: Salary structures and benefits packages
- **Training & Development**: Skills development programs

What specific employee management challenge or question do you have? I can provide detailed guidance tailored to your needs.`
    }
    // Recruitment Responses
    if (lowerInput.includes('recruit') || lowerInput.includes('hiring') || lowerInput.includes('job') || lowerInput.includes('candidate') || lowerInput.includes('interview')) {
      if (lowerInput.includes('job post') || lowerInput.includes('job description') || lowerInput.includes('job ad')) {
        return `Creating an effective job posting is crucial for attracting the right candidates. Here's how to write compelling job descriptions:

**Essential Components:**
1. **Job Title**: Clear, specific, and searchable
2. **Company Overview**: Brief introduction to your company
3. **Job Summary**: 2-3 sentence overview of the role
4. **Key Responsibilities**: 5-8 bullet points of main duties
5. **Required Qualifications**: Must-have skills and experience
6. **Preferred Qualifications**: Nice-to-have attributes
7. **Benefits & Compensation**: Salary range and perks
8. **Application Instructions**: How to apply

**Best Practices:**
- Use inclusive language
- Focus on outcomes, not just tasks
- Highlight growth opportunities
- Be transparent about expectations
- Include diversity statements
- Optimize for SEO (relevant keywords)
- Keep it concise (500-800 words)

**Example Structure:**
\`\`\`
Job Title: [Specific Role]
Location: [City/Remote/Hybrid]
Type: [Full-time/Part-time/Contract]

About Us: [Company mission and culture]

What You'll Do:
- Responsibility 1
- Responsibility 2
- Responsibility 3

What We're Looking For:
- Requirement 1
- Requirement 2

What We Offer:
- Benefit 1
- Benefit 2
\`\`\`

Would you like me to help you craft a job posting for a specific role?`
      }
      if (lowerInput.includes('interview') || lowerInput.includes('screening') || lowerInput.includes('candidate')) {
        return `Effective interviewing is key to finding the right talent. Here's a comprehensive guide:

**Interview Types:**
1. **Phone/Video Screening**: Initial qualification (15-30 min)
2. **Technical Interview**: Skills assessment
3. **Behavioral Interview**: Past experience and soft skills
4. **Panel Interview**: Multiple interviewers
5. **Final Interview**: Decision-making stage

**Best Practices:**

**Before the Interview:**
- Review the candidate's resume thoroughly
- Prepare structured questions
- Set up the interview space/technology
- Coordinate with other interviewers

**During the Interview:**
- Start with introductions and small talk
- Use the STAR method (Situation, Task, Action, Result)
- Ask open-ended questions
- Listen actively (80% listening, 20% talking)
- Take notes
- Allow time for candidate questions

**Key Questions to Ask:**
- "Tell me about a challenging project you worked on"
- "How do you handle tight deadlines?"
- "Describe a time you had to learn something new quickly"
- "What motivates you in your work?"
- "Why are you interested in this role?"

**Red Flags to Watch For:**
- Vague answers or inability to provide examples
- Negative comments about previous employers
- Lack of preparation or research
- Poor communication skills
- Misalignment with company values

**After the Interview:**
- Document feedback immediately
- Use a scoring rubric for consistency
- Compare notes with other interviewers
- Make timely decisions

Would you like help creating interview questions for a specific role or setting up an interview process?`
      }
      if (lowerInput.includes('offer') || lowerInput.includes('salary') || lowerInput.includes('compensation') || lowerInput.includes('negotiate')) {
        return `Creating competitive job offers requires balancing market rates, budget, and candidate expectations:

**Components of a Job Offer:**
1. **Base Salary**: Competitive market rate
2. **Benefits Package**: Health, dental, retirement, etc.
3. **Equity/Stock Options**: If applicable
4. **Bonus Structure**: Performance-based incentives
5. **Time Off**: Vacation and PTO policies
6. **Start Date**: When the role begins
7. **Reporting Structure**: Who they'll report to

**Best Practices:**
- Research market rates (Glassdoor, Payscale, industry reports)
- Consider total compensation, not just salary
- Be transparent about the offer
- Provide offer in writing
- Set a reasonable deadline for response
- Be prepared to negotiate

**Negotiation Tips:**
- Understand your budget constraints
- Know your walk-away point
- Consider non-salary benefits if salary is capped
- Be respectful and professional
- Document everything

**Common Offer Elements:**
- Sign-on bonus
- Relocation assistance
- Flexible work arrangements
- Professional development budget
- Equipment/technology allowances

Would you like help structuring an offer for a specific role or navigating a negotiation?`
      }
      return `I can help you with various aspects of recruitment and hiring:

**Key Areas:**
- **Job Postings**: Writing compelling job descriptions
- **Candidate Sourcing**: Finding qualified applicants
- **Screening & Interviews**: Evaluating candidates effectively
- **Offer Management**: Creating competitive offers
- **Onboarding**: Integrating new hires
- **Recruitment Strategy**: Building a hiring process
- **Employer Branding**: Attracting top talent
- **ATS (Applicant Tracking Systems)**: Managing applications

**Recruitment Best Practices:**
- Define clear job requirements
- Use multiple sourcing channels
- Create a positive candidate experience
- Make data-driven decisions
- Reduce time-to-hire
- Improve offer acceptance rates

What specific recruitment challenge or question do you have? I can provide detailed guidance.`
    }
    // Accounting Responses
    if (lowerInput.includes('account') || lowerInput.includes('finance') || lowerInput.includes('budget') || lowerInput.includes('bookkeep') || lowerInput.includes('tax') || lowerInput.includes('expense')) {
      if (lowerInput.includes('bookkeep') || lowerInput.includes('record') || lowerInput.includes('journal') || lowerInput.includes('ledger')) {
        return `Bookkeeping is the foundation of good financial management. Here's a comprehensive overview:

**Core Bookkeeping Tasks:**
1. **Recording Transactions**: All income and expenses
2. **Categorizing**: Assigning transactions to accounts
3. **Reconciling**: Matching bank statements with records
4. **Generating Reports**: Financial statements and summaries

**Key Principles:**
- **Double-Entry Bookkeeping**: Every transaction affects at least two accounts
- **Accrual vs. Cash Basis**: When to recognize revenue/expenses
- **Chart of Accounts**: Organized list of all accounts
- **General Ledger**: Master record of all transactions

**Essential Accounts:**
- **Assets**: Cash, accounts receivable, inventory, equipment
- **Liabilities**: Accounts payable, loans, credit cards
- **Equity**: Owner's equity, retained earnings
- **Revenue**: Sales, service income
- **Expenses**: Operating costs, salaries, utilities

**Best Practices:**
- Record transactions daily or weekly
- Keep receipts and documentation
- Reconcile accounts monthly
- Use accounting software (QuickBooks, Xero, FreshBooks)
- Separate business and personal finances
- Maintain organized records
- Review financial statements regularly

**Common Mistakes to Avoid:**
- Mixing personal and business expenses
- Not reconciling accounts regularly
- Incorrect categorization
- Missing transactions
- Poor documentation

Would you like help setting up a bookkeeping system or understanding specific accounting concepts?`
      }
      if (lowerInput.includes('tax') || lowerInput.includes('irs') || lowerInput.includes('deduction') || lowerInput.includes('filing')) {
        return `Tax management is crucial for compliance and optimization. Here's what you need to know:

**Key Tax Concepts:**
- **Income Tax**: Federal and state taxes on business income
- **Payroll Tax**: Social Security, Medicare, unemployment
- **Sales Tax**: If applicable to your business
- **Deductions**: Business expenses that reduce taxable income
- **Credits**: Direct reductions in tax liability

**Common Business Deductions:**
- Office expenses and supplies
- Travel and meals (50% deductible)
- Vehicle expenses
- Professional services (legal, accounting)
- Software and subscriptions
- Marketing and advertising
- Employee salaries and benefits
- Depreciation of assets
- Home office (if qualified)

**Tax Planning Tips:**
- Keep detailed records throughout the year
- Understand your business structure (LLC, S-Corp, etc.)
- Make estimated tax payments quarterly
- Maximize deductions legally
- Consider tax-advantaged retirement plans
- Work with a tax professional
- Stay updated on tax law changes

**Important Deadlines:**
- **Quarterly Estimated Taxes**: April, June, September, January
- **Annual Tax Return**: March 15 (S-Corp) or April 15 (Partnership/Individual)
- **Payroll Taxes**: Monthly or semi-weekly
- **1099 Forms**: January 31

**Best Practices:**
- Use accounting software for tracking
- Separate business and personal expenses
- Maintain organized records
- Consult with a CPA for complex situations
- Plan ahead for tax season

Would you like help with specific tax questions or setting up a tax management system?`
      }
      if (lowerInput.includes('financial report') || lowerInput.includes('statement') || lowerInput.includes('balance sheet') || lowerInput.includes('income statement') || lowerInput.includes('cash flow')) {
        return `Financial statements provide crucial insights into your business's financial health:

**Key Financial Statements:**

1. **Balance Sheet** (Statement of Financial Position)
   - Shows: Assets, Liabilities, and Equity at a point in time
   - Formula: Assets = Liabilities + Equity
   - Key metrics: Current ratio, debt-to-equity ratio

2. **Income Statement** (Profit & Loss Statement)
   - Shows: Revenue, Expenses, and Net Income over a period
   - Key metrics: Gross profit margin, net profit margin, EBITDA

3. **Cash Flow Statement**
   - Shows: Cash inflows and outflows from operations, investing, and financing
   - Key metrics: Operating cash flow, free cash flow

**How to Read Financial Statements:**
- **Balance Sheet**: Assess liquidity and financial position
- **Income Statement**: Evaluate profitability and performance
- **Cash Flow**: Understand cash generation and usage

**Key Ratios to Monitor:**
- **Current Ratio**: Current Assets / Current Liabilities (liquidity)
- **Gross Margin**: (Revenue - COGS) / Revenue
- **Net Profit Margin**: Net Income / Revenue
- **Debt-to-Equity**: Total Debt / Total Equity
- **Return on Assets**: Net Income / Total Assets

**Best Practices:**
- Generate statements monthly
- Compare to previous periods
- Benchmark against industry standards
- Use for decision-making
- Share with stakeholders regularly

Would you like help understanding specific financial statements or calculating key metrics?`
      }
      return `I can help you with various accounting and financial management topics:

**Key Areas:**
- **Bookkeeping**: Recording and organizing financial transactions
- **Financial Reporting**: Balance sheets, income statements, cash flow
- **Tax Management**: Deductions, filing, compliance
- **Budgeting & Forecasting**: Financial planning and projections
- **Expense Management**: Tracking and controlling costs
- **Payroll**: Employee compensation and taxes
- **Accounts Receivable/Payable**: Managing money owed and owing
- **Financial Analysis**: Interpreting financial data

**Accounting Best Practices:**
- Maintain accurate records
- Reconcile accounts regularly
- Use accounting software
- Separate business and personal finances
- Work with professionals when needed
- Review financial statements monthly
- Plan for taxes throughout the year

What specific accounting question or challenge can I help you with?`
    }
    // E-Invoicing Responses
    if (lowerInput.includes('invoice') || lowerInput.includes('billing') || lowerInput.includes('payment') || lowerInput.includes('receivable') || lowerInput.includes('bill')) {
      if (lowerInput.includes('create') || lowerInput.includes('make') || lowerInput.includes('generate') || lowerInput.includes('template')) {
        return `Creating professional invoices is essential for getting paid on time. Here's a comprehensive guide:

**Essential Invoice Components:**
1. **Invoice Number**: Unique identifier (e.g., INV-2024-001)
2. **Date**: Invoice date and due date
3. **Your Business Info**: Name, address, contact details, tax ID
4. **Client Information**: Billing address and contact
5. **Itemized Services/Products**: Description, quantity, rate, total
6. **Subtotal**: Sum of all items
7. **Taxes**: Sales tax, VAT (if applicable)
8. **Total Amount Due**: Final amount
9. **Payment Terms**: Net 30, Due on receipt, etc.
10. **Payment Methods**: Bank transfer, check, credit card, PayPal

**Invoice Template Structure:**
\`\`\`
[Your Company Logo]
[Company Name]
[Address]
[Phone] | [Email]

INVOICE #: [Number]
DATE: [Date]
DUE DATE: [Date]

BILL TO:
[Client Name]
[Client Address]

DESCRIPTION          QTY    RATE    AMOUNT
─────────────────────────────────────────
[Service/Product]    [Qty]  [$Rate]  [$Total]
[Service/Product]    [Qty]  [$Rate]  [$Total]

                              SUBTOTAL: $X
                              TAX: $X
                              TOTAL: $X

Payment Terms: Net 30
Payment Methods: [List options]
\`\`\`

**Best Practices:**
- Use professional invoice software (QuickBooks, FreshBooks, Zoho)
- Include clear payment terms
- Send invoices promptly
- Follow up on overdue invoices
- Keep copies of all invoices
- Number invoices sequentially
- Use clear, professional language
- Include payment instructions

**Payment Terms Options:**
- Net 15, 30, 60, 90 (days to pay)
- Due on receipt
- 2/10 Net 30 (2% discount if paid in 10 days)
- Milestone-based payments

Would you like help creating a specific invoice template or setting up an invoicing system?`
      }
      if (lowerInput.includes('overdue') || lowerInput.includes('late') || lowerInput.includes('collection') || lowerInput.includes('unpaid')) {
        return `Managing overdue invoices requires a systematic approach:

**Prevention Strategies:**
- Clear payment terms upfront
- Send invoices promptly
- Use professional invoicing software
- Require deposits for large projects
- Offer multiple payment methods
- Build strong client relationships

**Collection Process:**

**1. Friendly Reminder (1-3 days overdue)**
- Send a polite email reminder
- Assume it's an oversight
- Include invoice copy and payment link

**2. Formal Reminder (7-14 days overdue)**
- More direct communication
- Restate payment terms
- Request confirmation of receipt

**3. Final Notice (30+ days overdue)**
- Formal demand letter
- State consequences (late fees, collection)
- Set a specific deadline

**4. Escalation (60+ days overdue)**
- Consider collection agency
- Legal action (if significant amount)
- Write off as bad debt (last resort)

**Email Templates:**

**Friendly Reminder:**
\`\`\`
Subject: Payment Reminder - Invoice #[Number]

Hi [Client Name],

I wanted to follow up on invoice #[Number] for $[Amount], which was due on [Date]. 

If you've already sent payment, please disregard this email. Otherwise, you can pay via [payment method] or [link].

Thank you!
\`\`\`

**Best Practices:**
- Be professional and courteous
- Document all communications
- Offer payment plans if needed
- Know when to escalate
- Consider late fees (if in contract)

Would you like help crafting collection emails or setting up an automated reminder system?`
      }
      if (lowerInput.includes('electronic') || lowerInput.includes('digital') || lowerInput.includes('online') || lowerInput.includes('automated')) {
        return `E-invoicing (electronic invoicing) offers many advantages over traditional paper invoices:

**Benefits of E-Invoicing:**
- **Faster Processing**: Instant delivery and payment
- **Cost Savings**: No printing, postage, or paper
- **Automation**: Recurring invoices, auto-reminders
- **Accuracy**: Reduced errors and disputes
- **Tracking**: Real-time status and analytics
- **Compliance**: Easier tax and audit compliance
- **Eco-Friendly**: Paperless process

**E-Invoicing Features:**
- Online invoice creation and sending
- Automated recurring invoices
- Payment gateway integration
- Invoice tracking and status
- Client portal access
- Automated reminders
- Multi-currency support
- Tax calculation
- Reporting and analytics

**Popular E-Invoicing Platforms:**
- **QuickBooks Online**: Comprehensive accounting + invoicing
- **FreshBooks**: User-friendly invoicing
- **Zoho Invoice**: Affordable option
- **Invoice2go**: Mobile-friendly
- **Wave**: Free invoicing solution
- **Xero**: Full accounting suite

**Implementation Steps:**
1. Choose an e-invoicing platform
2. Set up your business profile
3. Create invoice templates
4. Configure payment methods
5. Set up automated reminders
6. Train your team
7. Migrate existing clients

**Compliance Considerations:**
- Digital signature requirements
- Data security and encryption
- Tax compliance (VAT, sales tax)
- Record retention policies
- Audit trail maintenance

Would you like help choosing an e-invoicing platform or setting up automated invoicing?`
      }
      return `I can help you with various aspects of invoicing and billing:

**Key Areas:**
- **Creating Invoices**: Professional invoice templates and best practices
- **E-Invoicing**: Digital invoicing systems and automation
- **Payment Processing**: Accepting payments online
- **Invoice Management**: Tracking and organizing invoices
- **Collections**: Managing overdue payments
- **Billing Cycles**: Setting up recurring billing
- **Invoice Analytics**: Tracking revenue and payment trends
- **Compliance**: Tax and legal requirements

**Invoicing Best Practices:**
- Send invoices promptly
- Use clear, professional templates
- Include all required information
- Set clear payment terms
- Follow up on overdue invoices
- Use invoicing software
- Track invoice status
- Maintain organized records

What specific invoicing question or challenge can I help you with?`
    }
    // General/Default Response
    if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
      return `Hello! I'm OmniChat, your AI assistant specialized in business operations. I'm here to help you with:

- **Employee Management**: Onboarding, performance reviews, leave management, HR policies
- **Recruitment**: Job postings, interviewing, candidate screening, offer management
- **Accounting**: Bookkeeping, financial reporting, tax management, budgeting
- **E-Invoicing**: Creating invoices, payment processing, collections, automation

What would you like to know more about? Feel free to ask me any questions, and I'll provide detailed, actionable guidance!`
    }
    if (lowerInput.includes('help') || lowerInput.includes('what can you') || lowerInput.includes('what do you')) {
      return `I'm OmniChat, your specialized business assistant! I can help you with:

**Employee Management:**
- Onboarding new employees
- Performance reviews and evaluations
- Leave and time-off management
- HR policies and procedures
- Employee relations

**Recruitment:**
- Writing job descriptions
- Interviewing best practices
- Candidate screening
- Offer creation and negotiation
- Hiring strategies

**Accounting:**
- Bookkeeping and record-keeping
- Financial statements and reporting
- Tax planning and compliance
- Budgeting and forecasting
- Expense management

**E-Invoicing:**
- Creating professional invoices
- Setting up e-invoicing systems
- Payment processing
- Managing overdue invoices
- Billing automation

Just ask me a specific question about any of these areas, and I'll provide detailed, helpful guidance! What would you like to know?`
    }
    // Default response for unrecognized queries
    return `I understand you're asking about: "${userInput}". 

I specialize in four main business areas:

1. **Employee Management** - HR processes, onboarding, performance reviews, leave management
2. **Recruitment** - Job postings, interviewing, candidate evaluation, hiring strategies  
3. **Accounting** - Bookkeeping, financial reporting, tax management, budgeting
4. **E-Invoicing** - Invoice creation, payment processing, collections, automation

Could you rephrase your question to focus on one of these areas? For example:
- "How do I create an employee onboarding checklist?"
- "What should I include in a job posting?"
- "How do I set up bookkeeping for my business?"
- "What's the best way to handle overdue invoices?"

I'm here to provide detailed, actionable guidance on any of these topics!`
  */ }

  const handleQuickTopic = (topic: string) => {
    setInput(topic)
    // Auto-send after a brief moment
    setTimeout(() => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: topic,
        timestamp: new Date(),
      }

      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setInput('')
      setIsLoading(true)
      setStreamingContent('')

      // Create new chat if this is the first user message
      let activeChatId = currentChatId
      if (!currentChatId || messages.length === 1) {
        const newChat: Chat = {
          id: Date.now().toString(),
          type: 'bot',
          title: generateChatTitle(topic),
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        activeChatId = newChat.id
        setCurrentChatId(newChat.id)
        setChats((prev) => [newChat, ...prev])
      } else if (activeChatId) {
        updateChatInList(activeChatId, updatedMessages)
      }

      const fullResponse = generateResponse(topic)
      let currentIndex = 0
      const typingSpeed = 15

      const typeResponse = () => {
        if (currentIndex < fullResponse.length) {
          setStreamingContent(fullResponse.substring(0, currentIndex + 1))
          currentIndex++
          setTimeout(typeResponse, typingSpeed)
        } else {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date(),
          }
          const finalMessages = [...updatedMessages, assistantMessage]
          setMessages(finalMessages)
          setStreamingContent('')
          setIsLoading(false)
          if (activeChatId) {
            updateChatInList(activeChatId, finalMessages)
          }
        }
      }
      setTimeout(typeResponse, 300)
    }, 100)
  }

  const handleNewChat = () => {
    setCurrentChatId(null)
    setMessages([getInitialMessage()])
    setShowChatList(false) // Show the welcome screen instead of chat list
  }

  const handleSelectChat = (chatId: string) => {
    const selectedChat = chats.find((chat) => chat.id === chatId)
    if (selectedChat) {
      setCurrentChatId(chatId)
      setMessages(selectedChat.messages)
      setShowChatList(false) // Hide chat list when a chat is selected
      // Mark as read
      setChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ))
    }
  }

  const handleContactClick = (contactId: string) => {
    const existingChat = chats.find(c => c.type === 'contact' && c.contactId === contactId)
    if (existingChat) {
      handleSelectChat(existingChat.id)
    } else {
      const contact = contacts.find(c => c.id === contactId)
      const newChat: Chat = {
        id: Date.now().toString(),
        type: 'contact',
        title: contact?.name || 'Contact',
        contactId: contactId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setChats(prev => [newChat, ...prev])
      setCurrentChatId(newChat.id)
      setMessages([])
    }
    setActiveTab('chats')
  }

  const handleGroupClick = (groupId: string) => {
    const existingChat = chats.find(c => c.type === 'group' && c.groupId === groupId)
    if (existingChat) {
      handleSelectChat(existingChat.id)
    } else {
      const group = groups.find(g => g.id === groupId)
      const newChat: Chat = {
        id: Date.now().toString(),
        type: 'group',
        title: group?.name || 'Group',
        groupId: groupId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setChats(prev => [newChat, ...prev])
      setCurrentChatId(newChat.id)
      setMessages([])
    }
    setActiveTab('chats')
  }

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || selectedContactsForGroup.length === 0) return
    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      members: selectedContactsForGroup,
      createdAt: new Date(),
    }

    setGroups(prev => [newGroup, ...prev])

    // Create chat for the group
    const newChat: Chat = {
      id: Date.now().toString(),
      type: 'group',
      title: newGroup.name,
      groupId: newGroup.id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setMessages([])

    // Reset form
    setNewGroupName('')
    setSelectedContactsForGroup([])
    setShowCreateGroup(false)
    setActiveTab('chats')
  }

  const toggleContactForGroup = (contactId: string) => {
    setSelectedContactsForGroup(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats((prev) => prev.filter((chat) => chat.id !== chatId))
    if (currentChatId === chatId) {
      if (chats.length > 1) {
        const remainingChats = chats.filter((chat) => chat.id !== chatId)
        if (remainingChats.length > 0) {
          handleSelectChat(remainingChats[0].id)
        } else {
          handleNewChat()
        }
      } else {
        handleNewChat()
      }
    }
  }

  const formatDate = (date: Date): string => {
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleLogout = () => {
    // Clear user data from localStorage
    localStorage.removeItem('omnichat-user-email')
    localStorage.removeItem('omnichat-user-name')
    router.push('/')
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditingContent(currentContent)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return

    // Find the index of the message being edited
    const messageIndex = messages.findIndex(m => m.id === editingMessageId)
    if (messageIndex === -1) return

    // Truncate messages at the edit point and update the content
    const messagesUpToEdit = messages.slice(0, messageIndex + 1)
    messagesUpToEdit[messageIndex] = {
      ...messagesUpToEdit[messageIndex],
      content: editingContent.trim()
    }

    // Update messages and clear edit state
    setMessages(messagesUpToEdit)
    setEditingMessageId(null)
    setEditingContent('')

    // Update chat history
    if (currentChatId) {
      updateChatInList(currentChatId, messagesUpToEdit)
    }

    // Regenerate AI response
    setIsLoading(true)
    setStreamingContent('')

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesUpToEdit.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            content: m.content
          }))
        }),
        signal: abortController.signal,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch response')
      }

      const fullResponse = data.response

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
      }
      const finalMessages = [...messagesUpToEdit, assistantMessage]
      setMessages(finalMessages)
      setStreamingContent('')
      setIsLoading(false)
      abortControllerRef.current = null

      if (currentChatId) {
        updateChatInList(currentChatId, finalMessages)
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted')
      } else {
        console.error('Error getting AI response:', error)
        setIsLoading(false)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to connect to AI service. Please check the console for details.'}`,
          timestamp: new Date(),
        }
        setMessages([...messagesUpToEdit, errorMessage])
      }
      abortControllerRef.current = null
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-primary-600 text-white flex flex-col">
        <div className="p-4 border-b border-primary-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-primary-200 truncate">{userEmail}</div>
            </div>
          </div>
        </div>
        {/* Chat Bot Section with History */}
        <div className="p-4 border-b border-primary-700">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-primary-200 uppercase tracking-wider">
              Chat Bot
            </div>
            <button
              onClick={handleNewChat}
              className="p-1.5 hover:bg-primary-500 rounded transition duration-200"
              title="New Chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {chats.filter(chat => chat.type === 'bot').map((chat) => {
              const lastMessage = chat.messages[chat.messages.length - 1]
              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${currentChatId === chat.id
                    ? 'bg-primary-500'
                    : 'hover:bg-primary-500/50'
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium truncate">{chat.title}</div>
                      {chat.unreadCount && chat.unreadCount > 0 && (
                        <span className="bg-white text-primary-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-2 flex-shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    {lastMessage && (
                      <div className="text-xs text-primary-200 truncate mt-0.5">
                        {lastMessage.content.substring(0, 30)}
                        {lastMessage.content.length > 30 ? '...' : ''}
                      </div>
                    )}
                    <div className="text-xs text-primary-200 mt-0.5">
                      {formatDate(chat.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary-400 rounded"
                    title="Delete chat"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
            {chats.filter(chat => chat.type === 'bot').length === 0 && (
              <div className="text-center text-primary-200 text-sm py-4">
                No bot chats yet
              </div>
            )}
          </div>
        </div>

        {/* Chats Button */}
        <div className="p-4 border-b border-primary-700">
          <button
            onClick={() => {
              setShowChatList(true)
              setShowOverlay(null)
            }}
            className="w-full px-4 py-2 text-sm font-medium bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition text-left"
          >
            Chats
          </button>
        </div>

        <div className="flex-1"></div>

        <div className="p-4 border-t border-primary-700">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-500 transition text-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat List View */}
        {showChatList && !currentChatId ? (
          <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center cursor-pointer">
                    <span className="text-white font-semibold">{userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setChatFilter('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${chatFilter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setChatFilter('unread')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${chatFilter === 'unread'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Unread ({chats.filter(c => (c.unreadCount && c.unreadCount > 0)).length})
                </button>
                <button
                  onClick={() => setChatFilter('groups')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${chatFilter === 'groups'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Groups
                </button>
                <button
                  onClick={() => setChatFilter('archived')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${chatFilter === 'archived'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Archived
                </button>
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-1">
                {(() => {
                  let filteredChats = chats.filter(chat => {
                    // Filter by type
                    if (chatFilter === 'groups') {
                      return chat.type === 'group'
                    }
                    if (chatFilter === 'unread') {
                      return chat.unreadCount && chat.unreadCount > 0
                    }
                    if (chatFilter === 'archived') {
                      return false // You can add archived property later
                    }
                    return chat.type === 'contact' || chat.type === 'group'
                  })

                  // Filter by search query
                  if (searchQuery.trim()) {
                    filteredChats = filteredChats.filter(chat =>
                      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  }

                  return filteredChats.map((chat) => {
                    const contact = chat.type === 'contact' ? contacts.find(c => c.id === chat.contactId) : null
                    const group = chat.type === 'group' ? groups.find(g => g.id === chat.groupId) : null
                    const lastMessage = chat.messages[chat.messages.length - 1]
                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition ${currentChatId === chat.id
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-gray-50'
                          }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                          {chat.type === 'group' ? (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          ) : (
                            <span className="text-base font-semibold text-white">
                              {contact?.name.charAt(0).toUpperCase() || 'C'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">{chat.title}</div>
                            {lastMessage && (
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {formatDate(chat.updatedAt)}
                              </span>
                            )}
                          </div>
                          {lastMessage && (
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600 truncate flex-1">
                                {lastMessage.senderName && chat.type === 'group' ? `${lastMessage.senderName}: ` : ''}
                                {lastMessage.content.substring(0, 50)}
                                {lastMessage.content.length > 50 ? '...' : ''}
                              </p>
                              {chat.unreadCount && chat.unreadCount > 0 && (
                                <span className="bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-2 flex-shrink-0">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()}
                {chats.filter(chat => chat.type === 'contact' || chat.type === 'group').length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <p className="mb-2">No conversations yet</p>
                    <p className="text-sm">Start chatting with contacts or groups!</p>
                  </div>
                )}
              </div>
            </div>

            {/* New Chat Button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowNewChatModal(true)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 bg-white p-4">
              {currentChatId ? (() => {
                const currentChat = chats.find(c => c.id === currentChatId)
                const contact = currentChat?.type === 'contact' ? contacts.find(c => c.id === currentChat.contactId) : null
                const group = currentChat?.type === 'group' ? groups.find(g => g.id === currentChat.groupId) : null
                return (
                  <div className="flex items-center gap-3">
                    {showChatList && (
                      <button
                        onClick={() => {
                          setShowChatList(true)
                          setCurrentChatId(null)
                          setMessages([getInitialMessage()])
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                      {currentChat?.type === 'group' ? (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      ) : currentChat?.type === 'contact' ? (
                        <span className="text-white font-semibold">
                          {contact?.name.charAt(0).toUpperCase() || 'C'}
                        </span>
                      ) : (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold text-gray-900">{currentChat?.title || 'Chat'}</h1>
                      {currentChat?.type === 'contact' && contact && (
                        <p className="text-sm text-gray-500">{contact.email}</p>
                      )}
                      {currentChat?.type === 'group' && group && (
                        <p className="text-sm text-gray-500">{group.members.length} members</p>
                      )}
                      {currentChat?.type === 'bot' && (
                        <p className="text-sm text-gray-500">AI Assistant</p>
                      )}
                    </div>
                  </div>
                )
              })() : (
                <>
                  <h1 className="text-2xl font-bold text-primary-600">OmniChat</h1>
                  <p className="text-sm text-gray-500">Select a chat to start messaging</p>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-white">
              {messages.length === 0 || (messages.length === 1 && messages[0].role === 'assistant' && !currentChatId) ? (
                <div className="flex flex-col items-center justify-center h-full px-4 py-8">
                  {/* Robot Icon */}
                  <div className="w-20 h-20 rounded-full bg-white border-2 border-primary-600 flex items-center justify-center mb-6">
                    <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>

                  {/* Main Question */}
                  <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center max-w-2xl">
                    How can I help you with your business operations today?
                  </h2>

                  {/* Suggestion Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-6xl mb-12">
                    {/* Card 1: Draft a recruitment email */}
                    <button
                      onClick={() => {
                        const message = 'Draft a recruitment email for a Senior Developer position'
                        const userMessage: Message = {
                          id: Date.now().toString(),
                          role: 'user',
                          content: message,
                          timestamp: new Date(),
                          senderId: 'me',
                          senderName: userName,
                        }
                        const updatedMessages = [...messages, userMessage]
                        setMessages(updatedMessages)

                        // Create new chat if needed
                        let activeChatId = currentChatId
                        if (!currentChatId || (messages.length === 1 && messages[0].role === 'assistant')) {
                          const newChat: Chat = {
                            id: Date.now().toString(),
                            type: 'bot',
                            title: generateChatTitle(message),
                            messages: updatedMessages,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }
                          activeChatId = newChat.id
                          setCurrentChatId(newChat.id)
                          setChats((prev) => [newChat, ...prev])
                        } else if (activeChatId) {
                          updateChatInList(activeChatId, updatedMessages)
                        }

                        // Generate AI response
                        setIsLoading(true)
                        setStreamingContent('')
                        const fullResponse = generateResponse(message)
                        let currentIndex = 0
                        const typingSpeed = 15

                        const typeResponse = () => {
                          if (currentIndex < fullResponse.length) {
                            setStreamingContent(fullResponse.substring(0, currentIndex + 1))
                            currentIndex++
                            setTimeout(typeResponse, typingSpeed)
                          } else {
                            const assistantMessage: Message = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: fullResponse,
                              timestamp: new Date(),
                            }
                            const finalMessages = [...updatedMessages, assistantMessage]
                            setMessages(finalMessages)
                            setStreamingContent('')
                            setIsLoading(false)

                            if (activeChatId) {
                              updateChatInList(activeChatId, finalMessages)
                            }
                          }
                        }

                        setTimeout(typeResponse, 300)
                      }}
                      className="bg-white border border-gray-300 rounded-lg p-4 hover:border-primary-600 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-700 transition">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">Draft a recruitment email</h3>
                          <p className="text-sm text-gray-600">For a Senior Developer position</p>
                        </div>
                      </div>
                    </button>

                    {/* Card 2: Explain e-invoicing */}
                    <button
                      onClick={() => {
                        const message = 'Explain e-invoicing - Latest regulations for 2024'
                        const userMessage: Message = {
                          id: Date.now().toString(),
                          role: 'user',
                          content: message,
                          timestamp: new Date(),
                          senderId: 'me',
                          senderName: userName,
                        }
                        const updatedMessages = [...messages, userMessage]
                        setMessages(updatedMessages)

                        let activeChatId = currentChatId
                        if (!currentChatId || (messages.length === 1 && messages[0].role === 'assistant')) {
                          const newChat: Chat = {
                            id: Date.now().toString(),
                            type: 'bot',
                            title: generateChatTitle(message),
                            messages: updatedMessages,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }
                          activeChatId = newChat.id
                          setCurrentChatId(newChat.id)
                          setChats((prev) => [newChat, ...prev])
                        } else if (activeChatId) {
                          updateChatInList(activeChatId, updatedMessages)
                        }

                        setIsLoading(true)
                        setStreamingContent('')
                        const fullResponse = generateResponse(message)
                        let currentIndex = 0
                        const typingSpeed = 15

                        const typeResponse = () => {
                          if (currentIndex < fullResponse.length) {
                            setStreamingContent(fullResponse.substring(0, currentIndex + 1))
                            currentIndex++
                            setTimeout(typeResponse, typingSpeed)
                          } else {
                            const assistantMessage: Message = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: fullResponse,
                              timestamp: new Date(),
                            }
                            const finalMessages = [...updatedMessages, assistantMessage]
                            setMessages(finalMessages)
                            setStreamingContent('')
                            setIsLoading(false)

                            if (activeChatId) {
                              updateChatInList(activeChatId, finalMessages)
                            }
                          }
                        }

                        setTimeout(typeResponse, 300)
                      }}
                      className="bg-white border border-gray-300 rounded-lg p-4 hover:border-primary-600 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-700 transition">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">Explain e-invoicing</h3>
                          <p className="text-sm text-gray-600">Latest regulations for 2024</p>
                        </div>
                      </div>
                    </button>

                    {/* Card 3: Process a refund */}
                    <button
                      onClick={() => {
                        const message = 'Process a refund - Step-by-step guide for clients'
                        const userMessage: Message = {
                          id: Date.now().toString(),
                          role: 'user',
                          content: message,
                          timestamp: new Date(),
                          senderId: 'me',
                          senderName: userName,
                        }
                        const updatedMessages = [...messages, userMessage]
                        setMessages(updatedMessages)

                        let activeChatId = currentChatId
                        if (!currentChatId || (messages.length === 1 && messages[0].role === 'assistant')) {
                          const newChat: Chat = {
                            id: Date.now().toString(),
                            type: 'bot',
                            title: generateChatTitle(message),
                            messages: updatedMessages,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }
                          activeChatId = newChat.id
                          setCurrentChatId(newChat.id)
                          setChats((prev) => [newChat, ...prev])
                        } else if (activeChatId) {
                          updateChatInList(activeChatId, updatedMessages)
                        }

                        setIsLoading(true)
                        setStreamingContent('')
                        const fullResponse = generateResponse(message)
                        let currentIndex = 0
                        const typingSpeed = 15

                        const typeResponse = () => {
                          if (currentIndex < fullResponse.length) {
                            setStreamingContent(fullResponse.substring(0, currentIndex + 1))
                            currentIndex++
                            setTimeout(typeResponse, typingSpeed)
                          } else {
                            const assistantMessage: Message = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: fullResponse,
                              timestamp: new Date(),
                            }
                            const finalMessages = [...updatedMessages, assistantMessage]
                            setMessages(finalMessages)
                            setStreamingContent('')
                            setIsLoading(false)

                            if (activeChatId) {
                              updateChatInList(activeChatId, finalMessages)
                            }
                          }
                        }

                        setTimeout(typeResponse, 300)
                      }}
                      className="bg-white border border-gray-300 rounded-lg p-4 hover:border-primary-600 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-700 transition">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">Process a refund</h3>
                          <p className="text-sm text-gray-600">Step-by-step guide for clients</p>
                        </div>
                      </div>
                    </button>

                    {/* Card 4: Payroll guidelines */}
                    <button
                      onClick={() => {
                        const message = 'Payroll guidelines - Updates on tax deductions'
                        const userMessage: Message = {
                          id: Date.now().toString(),
                          role: 'user',
                          content: message,
                          timestamp: new Date(),
                          senderId: 'me',
                          senderName: userName,
                        }
                        const updatedMessages = [...messages, userMessage]
                        setMessages(updatedMessages)

                        let activeChatId = currentChatId
                        if (!currentChatId || (messages.length === 1 && messages[0].role === 'assistant')) {
                          const newChat: Chat = {
                            id: Date.now().toString(),
                            type: 'bot',
                            title: generateChatTitle(message),
                            messages: updatedMessages,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }
                          activeChatId = newChat.id
                          setCurrentChatId(newChat.id)
                          setChats((prev) => [newChat, ...prev])
                        } else if (activeChatId) {
                          updateChatInList(activeChatId, updatedMessages)
                        }

                        setIsLoading(true)
                        setStreamingContent('')
                        const fullResponse = generateResponse(message)
                        let currentIndex = 0
                        const typingSpeed = 15

                        const typeResponse = () => {
                          if (currentIndex < fullResponse.length) {
                            setStreamingContent(fullResponse.substring(0, currentIndex + 1))
                            currentIndex++
                            setTimeout(typeResponse, typingSpeed)
                          } else {
                            const assistantMessage: Message = {
                              id: (Date.now() + 1).toString(),
                              role: 'assistant',
                              content: fullResponse,
                              timestamp: new Date(),
                            }
                            const finalMessages = [...updatedMessages, assistantMessage]
                            setMessages(finalMessages)
                            setStreamingContent('')
                            setIsLoading(false)

                            if (activeChatId) {
                              updateChatInList(activeChatId, finalMessages)
                            }
                          }
                        }

                        setTimeout(typeResponse, 300)
                      }}
                      className="bg-white border border-gray-300 rounded-lg p-4 hover:border-primary-600 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-700 transition">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">Payroll guidelines</h3>
                          <p className="text-sm text-gray-600">Updates on tax deductions</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* TODAY Divider */}
                  <div className="flex items-center gap-4 w-full max-w-6xl mt-auto">
                    <div className="flex-1 h-px bg-gray-300"></div>
                    <span className="text-sm text-gray-500 font-medium">TODAY</span>
                    <div className="flex-1 h-px bg-gray-300"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {messages.map((message) => {
                    const isUser = message.role === 'user' || message.senderId === 'me'
                    const currentChat = chats.find(c => c.id === currentChatId)
                    const isGroup = currentChat?.type === 'group'

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                            {message.role === 'contact' ? (
                              <span className="text-white text-xs font-semibold">
                                {message.senderName?.charAt(0).toUpperCase() || 'C'}
                              </span>
                            ) : (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            )}
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                          {isGroup && !isUser && message.senderName && (
                            <span className="text-xs text-gray-600 mb-1 px-2">{message.senderName}</span>
                          )}
                          <div
                            className={`group/message relative rounded-2xl px-3 py-2 ${isUser
                              ? 'bg-primary-600 text-white rounded-tr-none'
                              : 'bg-white text-gray-800 rounded-tl-none shadow-sm'
                              }`}
                          >
                            {/* Edit button for user messages */}
                            {isUser && message.role === 'user' && editingMessageId !== message.id && (
                              <button
                                onClick={() => handleEditMessage(message.id, message.content)}
                                className="absolute -right-8 top-2 opacity-0 group-hover/message:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                                title="Edit message"
                              >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}

                            {/* Editing mode */}
                            {editingMessageId === message.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full min-h-[80px] px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y"
                                  autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={!editingContent.trim()}
                                    className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Save & Regenerate
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.content && (
                                  <div className={`text-sm prose prose-sm max-w-none break-words overflow-hidden ${isUser ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                        code: ({ node, ...props }) => <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
                                        pre: ({ node, ...props }) => <pre className="bg-gray-800 text-white rounded p-2 mb-2 overflow-x-auto text-xs" {...props} />,
                                        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2" {...props} />,
                                        table: ({ node, ...props }) => <div className="overflow-x-auto mb-2"><table className="min-w-full divide-y divide-gray-200 border border-gray-200" {...props} /></div>,
                                        thead: ({ node, ...props }) => <thead className="bg-gray-50 text-gray-500" {...props} />,
                                        tbody: ({ node, ...props }) => <tbody className="bg-white text-gray-500 divide-y divide-gray-200" {...props} />,
                                        tr: ({ node, ...props }) => <tr className="" {...props} />,
                                        th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider border-r last:border-r-0 border-gray-200" {...props} />,
                                        td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-nowrap text-sm border-r last:border-r-0 border-gray-200" {...props} />,
                                      }}
                                    >
                                      {message.content.replace(/<br\s*\/?>/gi, '\n')}
                                    </ReactMarkdown>
                                  </div>
                                )}

                                {/* YouTube Video Embed */}
                                {!isUser && message.content && (() => {
                                  const videoId = extractYouTubeVideoId(message.content)
                                  return videoId ? (
                                    <div className="mt-3 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', maxWidth: '500px' }}>
                                      <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${videoId}`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        className="rounded-lg"
                                      ></iframe>
                                    </div>
                                  ) : null
                                })()}
                              </>
                            )}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className={`mt-2 space-y-2 ${isUser ? '' : ''}`}>
                                {message.attachments.map((attachment) => (
                                  <div key={attachment.id} className={`rounded-lg p-2 ${isUser ? 'bg-white/20' : 'bg-gray-100'}`}>
                                    {attachment.thumbnail ? (
                                      <div className="space-y-2">
                                        <img
                                          src={attachment.thumbnail}
                                          alt={attachment.name}
                                          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90"
                                          onClick={() => window.open(attachment.url, '_blank')}
                                        />
                                        <div className="flex items-center justify-between">
                                          <span className={`text-xs truncate ${isUser ? 'text-white' : 'text-gray-700'}`}>{attachment.name}</span>
                                          <a
                                            href={attachment.url}
                                            download={attachment.name}
                                            className={`text-xs underline hover:no-underline ${isUser ? 'text-white' : 'text-primary-600'}`}
                                          >
                                            Download
                                          </a>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <svg className={`w-5 h-5 ${isUser ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span className={`text-xs truncate ${isUser ? 'text-white' : 'text-gray-700'}`}>{attachment.name}</span>
                                          <span className={`text-xs ${isUser ? 'text-white/80' : 'text-gray-500'}`}>
                                            ({(attachment.size / 1024).toFixed(1)} KB)
                                          </span>
                                        </div>
                                        <a
                                          href={attachment.url}
                                          download={attachment.name}
                                          className={`text-xs underline hover:no-underline px-2 py-1 rounded ${isUser ? 'text-white bg-white/20' : 'text-primary-600 bg-white'}`}
                                        >
                                          Download
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 mt-1 px-2">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isUser && (
                          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">
                              {userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {isLoading && streamingContent && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 max-w-[85%] break-words w-fit shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{streamingContent}<span className="animate-pulse">▊</span></p>
                  </div>
                </div>
              )}

              {isLoading && !streamingContent && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white p-4">
              <form onSubmit={handleSend} className="max-w-4xl mx-auto w-full">
                {/* Parsing Status */}
                {isParsingDocument && (
                  <div className="mb-3 flex items-center gap-2 text-primary-600 animate-pulse">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium">Reading document...</span>
                  </div>
                )}

                {!isParsingDocument && documentContent && (
                  <div className="mb-3 flex items-center gap-2 text-green-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">Document content analyzed! Ask anything about it.</span>
                  </div>
                )}

                {/* Attachment Preview */}
                {attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="relative inline-flex items-center gap-2 bg-gray-100 rounded-lg p-2 pr-8"
                      >
                        {attachment.thumbnail ? (
                          <img
                            src={attachment.thumbnail}
                            alt={attachment.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <span className="text-xs text-gray-700 truncate max-w-[100px]">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute top-1 right-1 p-1 hover:bg-gray-200 rounded-full"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition duration-200 cursor-pointer flex items-center justify-center flex-shrink-0"
                    title="Upload file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </label>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={currentChatId ? "Type a message..." : "Select a chat to start messaging..."}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none min-w-0"
                    disabled={isLoading}
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition duration-200 flex items-center justify-center flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!input.trim() && attachments.length === 0)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between mt-2 gap-2">
                  <p className="text-xs text-gray-500">
                    OmniChat can make mistakes. Check important information.
                  </p>
                  <button
                    type="button"
                    onClick={downloadInvoicePDF}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Invoice PDF
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Contacts Overlay */}
      {showOverlay === 'contacts' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Contacts</h2>
              <button
                onClick={() => setShowOverlay(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => {
                      handleContactClick(contact.id)
                      setShowOverlay(null)
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="relative w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                      {contact.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-gray-900">{contact.name}</div>
                      <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups Overlay */}
      {showOverlay === 'groups' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Groups</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="Create Group"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowOverlay(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => {
                      handleGroupClick(group.id)
                      setShowOverlay(null)
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-gray-900">{group.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {group.members.length} members
                      </div>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    No groups yet. Create a group to get started!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Group</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Contacts
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContactsForGroup.includes(contact.id)}
                      onChange={() => toggleContactForGroup(contact.id)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false)
                  setNewGroupName('')
                  setSelectedContactsForGroup([])
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || selectedContactsForGroup.length === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal - Contacts and Groups */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">New Chat</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'contacts'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Contacts ({contacts.length})
                </button>
                <button
                  onClick={() => setActiveTab('groups')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'groups'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Groups ({groups.length})
                </button>
                <button
                  onClick={() => {
                    setShowNewChatModal(false)
                    handleNewChat()
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'chats'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Chat Bot
                </button>
              </div>

              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div className="space-y-2">
                  {contacts.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <p>No contacts available</p>
                    </div>
                  ) : (
                    contacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => {
                          handleContactClick(contact.id)
                          setShowNewChatModal(false)
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold">
                            {contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{contact.name}</div>
                          <div className="text-sm text-gray-500">{contact.email}</div>
                        </div>
                        {contact.isOnline && (
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Groups Tab */}
              {activeTab === 'groups' && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setShowNewChatModal(false)
                      setShowCreateGroup(true)
                    }}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition flex items-center justify-center gap-2 text-primary-600 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Group
                  </button>
                  {groups.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <p>No groups available</p>
                    </div>
                  ) : (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => {
                          handleGroupClick(group.id)
                          setShowNewChatModal(false)
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{group.name}</div>
                          <div className="text-sm text-gray-500">{group.members.length} members</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

