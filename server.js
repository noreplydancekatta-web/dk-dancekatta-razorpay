const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect('mongodb://dance_katta_user:User%23DanceKatta%402026@localhost:27017/dance_katta_db?authSource=dance_katta_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const paymentDetailsSchema = new mongoose.Schema({
  amountPaid: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  transactionId: { type: String, required: true },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, default: null },
  studentEmail: { type: String, default: null },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchName: { type: String, default: null },
  branchName: { type: String, default: null },
  studioName: { type: String, required: true },
  mode: { type: String, default: 'Online' },
  status: { type: String, required: true },
  date: { type: Date, default: Date.now },
  transactionDate: { type: Date, default: Date.now },
  couponCode: { type: String, default: null },
  discountPercent: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  platformFeePercent: { type: Number, required: true },
  gstPercent: { type: Number, required: true },
  paymentDetails: { type: paymentDetailsSchema, required: true },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

const platformFeeSchema = new mongoose.Schema({
  feePercent: { type: Number, required: true, default: 10 },
  gstPercent: { type: Number, required: true, default: 18 },
}, { timestamps: true });

const PlatformFee = mongoose.model('PlatformFee', platformFeeSchema);

const Batch = mongoose.model('Batch', new mongoose.Schema({}, { strict: false }));
const Branch = mongoose.model('Branch', new mongoose.Schema({}, { strict: false }));
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

// ─── App setup ───────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Email setup ─────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Success email — styled HTML matching DanceKatta theme
const sendSuccessEmail = async (userEmail, data) => {
  try {
    if (!userEmail || !userEmail.includes('@')) {
      console.log('❌ Invalid email, skipping:', userEmail);
      return;
    }

    const mailOptions = {
      from: `"Dance Katta" <${process.env.EMAIL_USER}>`,
      to: userEmail.trim().toLowerCase(),
      subject: `🎉 Enrollment Confirmed – ${data.batchName} at ${data.studioName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: #3A5ED4; padding: 30px 24px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .header p { color: #ccd6ff; margin: 6px 0 0; font-size: 14px; }
            .body { padding: 28px 24px; color: #333; }
            .body h2 { margin-top: 0; font-size: 20px; }
            .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .details-table tr td { padding: 10px 12px; font-size: 14px; }
            .details-table tr:nth-child(odd) td { background: #f0f4ff; }
            .details-table tr td:first-child { font-weight: bold; color: #555; width: 40%; }
            .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
            .footer { background: #f9f9f9; text-align: center; padding: 16px; font-size: 12px; color: #999; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💃 Dance Katta</h1>
              <p>Enrollment Confirmation</p>
            </div>
            <div class="body">
              <h2>Hi ${data.studentName || 'Student'}, you're enrolled! 🎉</h2>
              <p>Your enrollment has been confirmed. Here are your details:</p>
              <table class="details-table">
                <tr><td>Studio</td><td>${data.studioName}</td></tr>
                <tr><td>Batch</td><td>${data.batchName || 'N/A'}</td></tr>
                <tr><td>Branch</td><td>${data.branchName || 'N/A'}</td></tr>
                <tr><td>Amount Paid</td><td><strong>₹${data.amount}</strong></td></tr>
                <tr><td>Payment Method</td><td>${data.paymentMethod || 'Razorpay'}</td></tr>
                <tr><td>Transaction ID</td><td>${data.transactionId}</td></tr>
                <tr><td>Date</td><td>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
              </table>
              <p><span class="badge">✅ Payment Successful</span></p>
              <p style="margin-top: 24px;">See you on the dance floor! 🕺</p>
              <p>– The Dance Katta Team</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} Dance Katta. All rights reserved.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Success email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send success email:', error);
  }
};

// ✅ Failure email
const sendFailureEmail = async (userEmail, data) => {
  try {
    if (!userEmail || !userEmail.includes('@')) return;

    const mailOptions = {
      from: `"Dance Katta" <${process.env.EMAIL_USER}>`,
      to: userEmail.trim().toLowerCase(),
      subject: `❌ Payment Failed – ${data.studioName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: #e53935; padding: 30px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">💃 Dance Katta</h1>
            <p style="color: #ffcdd2; margin: 6px 0 0;">Payment Failed</p>
          </div>
          <div style="padding: 28px 24px; color: #333;">
            <h2 style="margin-top: 0;">Hi ${data.studentName || 'Student'},</h2>
            <p>Unfortunately your payment could not be processed.</p>
            <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 10px 12px; font-weight: bold; background: #fff3f3; width:40%;">Studio</td><td style="padding: 10px 12px; background: #fff3f3;">${data.studioName}</td></tr>
              <tr><td style="padding: 10px 12px; font-weight: bold;">Batch</td><td style="padding: 10px 12px;">${data.batchName || 'N/A'}</td></tr>
              <tr><td style="padding: 10px 12px; font-weight: bold; background: #fff3f3;">Amount</td><td style="padding: 10px 12px; background: #fff3f3;">₹${data.amount}</td></tr>
            </table>
            <p>Please try again or contact our support team.</p>
            <p>– The Dance Katta Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Failure email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Failed to send failure email:', error);
  }
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// Create Order
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;
    const options = {
      amount: amount * 100,
      currency,
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
  }
});

// Verify Payment
app.post('/verify-payment', async (req, res) => {
  // ✅ Declare these at the TOP so they're accessible in both if and else blocks
  let studentNameFinal = 'Student';
  let studentEmailFinal = '';
  let batchNameFinal = 'Unknown Batch';
  let branchNameFinal = 'Unknown Branch';

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      studentName,
      batchId,
      batchName,
      branchName,
      studioName,
      userEmail,
      amount,
      couponCode,
      discountAmount,
      discountPercent,
    } = req.body;

    console.log('verify-payment received:', {
      studentId, studentName, batchId, batchName, branchName, studioName, userEmail, amount
    });

    // Fetch latest platform fee config
    let platformFeePercent = 5;
    let gstPercent = 18;
    try {
      const feeConfig = await PlatformFee.findOne().sort({ createdAt: -1 });
      if (feeConfig) {
        platformFeePercent = feeConfig.feePercent;
        gstPercent = feeConfig.gstPercent;
      }
    } catch (err) {
      console.log('Failed to fetch platform fee config, using defaults');
    }

    // ✅ Fetch DB data BEFORE signature check so names are available in else block too
    let user = null;
    let batch = null;
    let branch = null;

    try {
      user = await User.findById(studentId);
      batch = await Batch.findById(batchId);
      if (batch?.branch) {
        branch = await Branch.findById(batch.branch);
      }
    } catch (err) {
      console.log('Snapshot fetch error:', err.message);
    }

    // ✅ Now assign final values — available everywhere below
    studentNameFinal = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'
      : studentName || 'Unknown';

    studentEmailFinal = user?.email || userEmail || '';
    batchNameFinal = batch?.batchName || batchName || 'Unknown Batch';
    branchNameFinal = branch?.name || branch?.branchName || branchName || 'Unknown Branch';

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {

      // Fetch payment method from Razorpay
      let paymentMethod = 'Razorpay';
      try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        paymentMethod = payment.method || 'Razorpay';
      } catch (e) {
        console.log('Failed to fetch payment method:', e.message);
      }

      // ✅ Save transaction
      const transaction = new Transaction({
        studentId,
        studentName: studentNameFinal,
        studentEmail: studentEmailFinal,
        batchName: batchNameFinal,
        branchName: branchNameFinal,
        batchId,
        studioName: studioName || 'Unknown Studio',
        mode: paymentMethod,
        status: 'Success',
        date: new Date(),
        transactionDate: new Date(),
        couponCode: couponCode || null,
        discountPercent: discountPercent || 0,
        discountAmount: discountAmount || 0,
        platformFeePercent,
        gstPercent,
        paymentDetails: {
          amountPaid: amount,
          paymentMethod: 'Razorpay',
          paymentStatus: 'Authorized',
          transactionId: razorpay_payment_id,
        },
      });

      await transaction.save();
      console.log('✅ Transaction saved:', transaction._id);

      // Add student to batch enrolled_students
      try {
        await mongoose.connection.db.collection('batches').updateOne(
          { _id: new mongoose.Types.ObjectId(batchId) },
          { $addToSet: { enrolled_students: new mongoose.Types.ObjectId(studentId) } }
        );
        console.log('✅ Student added to batch');
      } catch (e) {
        console.error('❌ Failed to update batch:', e.message);
      }

      // Add batch to user enrolled_batches
      try {
        await mongoose.connection.db.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(studentId) },
          { $addToSet: { enrolled_batches: new mongoose.Types.ObjectId(batchId) } }
        );
        console.log('✅ Batch added to user');
      } catch (e) {
        console.error('❌ Failed to update user:', e.message);
      }

      // ✅ Send success email
      await sendSuccessEmail(studentEmailFinal, {
        studentName: studentNameFinal,
        studioName: studioName || 'Unknown Studio',
        batchName: batchNameFinal,
        branchName: branchNameFinal,
        amount,
        paymentMethod,
        transactionId: razorpay_payment_id,
      });

      res.json({
        success: true,
        message: 'Payment verified and transaction saved',
        payment_id: razorpay_payment_id,
        transaction_id: transaction._id,
      });

    } else {
      // ✅ Now studentNameFinal etc. are in scope here — no crash
      console.log('❌ Signature mismatch');

      await sendFailureEmail(studentEmailFinal, {
        studentName: studentNameFinal,
        studioName: studioName || 'Unknown Studio',
        batchName: batchNameFinal,
        branchName: branchNameFinal,
        amount,
      });

      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

  } catch (error) {
    console.error('❌ verify-payment error:', error);
    res.status(500).json({ success: false, message: 'Verification error', error: error.message });
  }
});

// ─── Webhook ─────────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body.toString());
    console.log('Webhook received:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      console.log('Payment captured:', payment.id, 'Amount:', payment.amount);
      await Transaction.updateOne(
        { 'paymentDetails.transactionId': payment.id },
        { $set: { 'paymentDetails.paymentStatus': 'Captured', 'paymentDetails.paymentDate': new Date() } }
      );
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      console.log('Payment failed:', payment.id);
      await Transaction.updateOne(
        { 'paymentDetails.transactionId': payment.id },
        { $set: { 'paymentDetails.paymentStatus': 'Failed' } }
      );
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Razorpay server running on http://localhost:${PORT}`);
});
