import express from 'express';
import WalletTransaction from '../models/WalletTransaction.js';
import AdminBankAccount from '../models/AdminBankAccount.js';
import Booking from '../models/Booking.js';
import UserSubscription from '../models/UserSubscription.js';
import ProfileBoost from '../models/ProfileBoost.js';

const router = express.Router();

// Helper to compute platform available balance
async function calculatePlatformFinances() {
  const [
    bookingPaidAgg,
    subscriptionPaidAgg,
    boostPaidAgg,
    platformCreditsAgg,
    adminWithdrawalsAgg,
    pendingWithdrawalsAgg
  ] = await Promise.all([
    // Revenue from paid bookings
    Booking.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]),
    // Revenue from paid subscriptions
    UserSubscription.aggregate([
      { $match: { amountPaid: { $gt: 0 } } },
      { $group: { _id: null, sum: { $sum: '$amountPaid' } } }
    ]),
    // Revenue from creator profile boosts
    ProfileBoost.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, sum: { $sum: '$amountPaid' } } }
    ]),
    // Other platform credits / wallet inflows
    WalletTransaction.aggregate([
      { $match: { type: 'Credit', status: 'Completed' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]),
    // Total successfully withdrawn by admin
    WalletTransaction.aggregate([
      { $match: { userType: 'Admin', type: 'Withdrawal', status: 'Completed' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ]),
    // Pending withdrawals
    WalletTransaction.aggregate([
      { $match: { userType: 'Admin', type: 'Withdrawal', status: 'Pending' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } }
    ])
  ]);

  const bookingRevenue      = bookingPaidAgg[0]?.sum || 0;
  const subscriptionRevenue = subscriptionPaidAgg[0]?.sum || 0;
  const boostRevenue        = boostPaidAgg[0]?.sum || 0;
  const platformCredits     = platformCreditsAgg[0]?.sum || 0;
  const totalInflow         = bookingRevenue + subscriptionRevenue + boostRevenue + platformCredits;
  const totalWithdrawn      = adminWithdrawalsAgg[0]?.sum || 0;
  const pendingWithdrawn    = pendingWithdrawalsAgg[0]?.sum || 0;
  const availableBalance    = Math.max(0, totalInflow - totalWithdrawn - pendingWithdrawn);

  return {
    bookingRevenue,
    subscriptionRevenue,
    boostRevenue,
    platformCredits,
    totalInflow,
    totalWithdrawn,
    pendingWithdrawn,
    availableBalance
  };
}

// ══════════════════════════════════════════════════════
//  GET /overview — Full financial & withdrawal overview
// ══════════════════════════════════════════════════════
router.get('/overview', async (req, res) => {
  try {
    const finances = await calculatePlatformFinances();

    const [savedBank, recentWithdrawals, allTxCount] = await Promise.all([
      AdminBankAccount.findOne({ adminId: 'SUPERADMIN' }),
      WalletTransaction.find({ userType: 'Admin', type: 'Withdrawal' })
        .sort({ createdAt: -1 })
        .limit(20),
      WalletTransaction.countDocuments()
    ]);

    res.json({
      ...finances,
      savedBank: savedBank || null,
      recentWithdrawals,
      allTxCount
    });
  } catch (err) {
    console.error('Wallet overview error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  POST /withdraw — Superadmin withdraws funds to bank/UPI
// ══════════════════════════════════════════════════════
router.post('/withdraw', async (req, res) => {
  try {
    const {
      amount,
      payoutMethod = 'Bank Transfer',
      bankDetails = {},
      saveAccount = true,
      notes = ''
    } = req.body;

    const withdrawAmt = Number(amount);
    if (!withdrawAmt || withdrawAmt <= 0) {
      return res.status(400).json({ message: 'Please enter a valid withdrawal amount.' });
    }

    // Check available balance
    const finances = await calculatePlatformFinances();
    if (withdrawAmt > finances.availableBalance) {
      return res.status(400).json({
        message: `Insufficient available balance! You can withdraw up to ₹${finances.availableBalance.toLocaleString('en-IN')}.`,
        availableBalance: finances.availableBalance
      });
    }

    // Validate payout destination
    if (payoutMethod === 'Bank Transfer') {
      if (!bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.accountHolder) {
        return res.status(400).json({
          message: 'Account Holder Name, Bank Account Number, and IFSC code are required for Bank Transfer.'
        });
      }
    } else if (payoutMethod === 'UPI') {
      if (!bankDetails.upiId || !bankDetails.upiId.includes('@')) {
        return res.status(400).json({ message: 'Please provide a valid UPI ID (e.g. yourname@oksbi).' });
      }
    }

    // Save or update default bank account for future convenience
    if (saveAccount) {
      await AdminBankAccount.findOneAndUpdate(
        { adminId: 'SUPERADMIN' },
        {
          $set: {
            adminId: 'SUPERADMIN',
            accountHolder: bankDetails.accountHolder || 'Super Admin',
            bankName: bankDetails.bankName || (payoutMethod === 'UPI' ? 'UPI Account' : 'Bank'),
            accountNumber: bankDetails.accountNumber || '',
            ifsc: (bankDetails.ifsc || '').toUpperCase(),
            accountType: bankDetails.accountType || 'Current',
            upiId: bankDetails.upiId || '',
            isVerified: true
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // Generate unique Payout ID & UTR
    const payoutId = `PO-${Date.now().toString().slice(-6)}`;
    const utrNumber = `UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const balanceAfter = finances.availableBalance - withdrawAmt;

    const desc = payoutMethod === 'UPI'
      ? `Withdrawal to UPI: ${bankDetails.upiId}`
      : `Bank Transfer to ${bankDetails.bankName || 'Bank'} (•••• ${bankDetails.accountNumber.slice(-4)})`;

    const withdrawalTx = new WalletTransaction({
      userId: 'SUPERADMIN',
      userType: 'Admin',
      userName: bankDetails.accountHolder || 'Super Admin',
      userContact: bankDetails.upiId || bankDetails.accountNumber || '',
      type: 'Withdrawal',
      amount: withdrawAmt,
      currency: 'INR',
      description: desc,
      referenceId: utrNumber,
      referenceType: 'Withdrawal',
      status: 'Completed',
      balanceAfter,
      payoutDetails: {
        payoutMethod,
        accountHolder: bankDetails.accountHolder || 'Super Admin',
        bankName: bankDetails.bankName || '',
        accountNumber: bankDetails.accountNumber || '',
        ifsc: (bankDetails.ifsc || '').toUpperCase(),
        upiId: bankDetails.upiId || '',
        utrNumber,
        payoutId
      },
      notes: notes || 'Admin profit withdrawal to personal account'
    });

    const saved = await withdrawalTx.save();

    res.status(201).json({
      success: true,
      message: `₹${withdrawAmt.toLocaleString('en-IN')} successfully withdrawn to your account!`,
      withdrawal: saved,
      newAvailableBalance: balanceAfter
    });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  BANK ACCOUNT — GET & POST Superadmin saved account
// ══════════════════════════════════════════════════════
router.get('/bank-account', async (req, res) => {
  try {
    const account = await AdminBankAccount.findOne({ adminId: 'SUPERADMIN' });
    res.json(account || {});
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

router.post('/bank-account', async (req, res) => {
  try {
    const { accountHolder, bankName, accountNumber, ifsc, accountType, upiId } = req.body;
    if (!accountHolder || !bankName || !accountNumber || !ifsc) {
      return res.status(400).json({ message: 'Account Holder, Bank Name, Account Number, and IFSC are required.' });
    }

    const updated = await AdminBankAccount.findOneAndUpdate(
      { adminId: 'SUPERADMIN' },
      {
        $set: {
          adminId: 'SUPERADMIN',
          accountHolder,
          bankName,
          accountNumber,
          ifsc: ifsc.toUpperCase(),
          accountType: accountType || 'Current',
          upiId: upiId || '',
          isVerified: true
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ success: true, message: 'Bank details saved successfully.', account: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  GET /withdrawals — All Superadmin withdrawal records
// ══════════════════════════════════════════════════════
router.get('/withdrawals', async (req, res) => {
  try {
    const withdrawals = await WalletTransaction.find({ userType: 'Admin', type: 'Withdrawal' })
      .sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  LEGACY COMPATIBILITY: STATS & TRANSACTIONS
// ══════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const finances = await calculatePlatformFinances();
    const [totalDebits, totalRefunds, totalBonuses, txCount, pendingCount] = await Promise.all([
      WalletTransaction.aggregate([{ $match: { type: 'Debit', status: 'Completed' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      WalletTransaction.aggregate([{ $match: { type: 'Refund', status: 'Completed' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      WalletTransaction.aggregate([{ $match: { type: 'Bonus', status: 'Completed' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      WalletTransaction.countDocuments(),
      WalletTransaction.countDocuments({ status: 'Pending' })
    ]);

    res.json({
      totalCredits:     finances.totalInflow,
      totalDebits:      totalDebits[0]?.sum || 0,
      totalRefunds:     totalRefunds[0]?.sum || 0,
      totalWithdrawals: finances.totalWithdrawn,
      totalBonuses:     totalBonuses[0]?.sum || 0,
      availableBalance: finances.availableBalance,
      bookingRevenue:   finances.bookingRevenue,
      subscriptionRevenue: finances.subscriptionRevenue,
      txCount,
      pendingCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { type, status, userType, search, limit = 100 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userType) filter.userType = userType;

    let txs = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    if (search) {
      const q = search.toLowerCase();
      txs = txs.filter(t =>
        t.userName?.toLowerCase().includes(q) ||
        t.userContact?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.referenceId?.toLowerCase().includes(q)
      );
    }

    res.json(txs);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

router.put('/transactions/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;

    const tx = await WalletTransaction.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const tx = await WalletTransaction.findByIdAndDelete(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

export default router;
