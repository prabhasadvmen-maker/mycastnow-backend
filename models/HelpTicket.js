import mongoose from 'mongoose';

const helpTicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    default: () => 'TKT-' + Math.floor(100000 + Math.random() * 900000)
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['General Query', 'Payment & Wallet', 'Castings & Bookings', 'Account & Security', 'Bug Report', 'Feature Request', 'Escrow & Invoicing', 'Talent Cart Support'],
    default: 'General Query'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    default: ''
  },
  adminEmail: {
    type: String,
    default: 'superadmin@mycastnow.com'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  companyName: {
    type: String,
    default: ''
  },
  companyEmail: {
    type: String,
    default: ''
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creator'
  },
  creatorName: {
    type: String,
    default: ''
  },
  creatorPhone: {
    type: String,
    default: ''
  },
  creatorEmail: {
    type: String,
    default: ''
  },
  senderType: {
    type: String,
    enum: ['Company', 'Creator', 'Admin'],
    default: 'Company'
  }
}, { timestamps: true });

export default mongoose.model('HelpTicket', helpTicketSchema);
