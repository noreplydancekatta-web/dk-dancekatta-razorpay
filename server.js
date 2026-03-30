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

// ─── Schemas ────────────────────────────────────────────────────────────────

const paymentDetailsSchema = new mongoose.Schema({
  amountPaid: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  transactionId: { type: String, required: true },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, default: null },   // ✅ stored
  studentEmail: { type: String, default: null },   // ✅ stored

  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  batchName: { type: String, default: null },   // ✅ stored
  branchName: { type: String, default: null },   // ✅ stored

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

// ─── Email ───────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendSuccessEmail = async (userEmail, transactionData) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Payment Successful - DanceKatta',
    html: `
      <h2>Payment Successful!</h2>
      <p>Dear ${transactionData.studentName || 'Student'},</p>
      <p>Your payment has been successfully processed.</p>
      <h3>Transaction Details:</h3>
      <ul>
        <li><strong>Studio:</strong> ${transactionData.studioName}</li>
        <li><strong>Batch:</strong> ${transactionData.batchName || 'N/A'}</li>
        <li><strong>Branch:</strong> ${transactionData.branchName || 'N/A'}</li>
        <li><strong>Amount:</strong> ₹${transactionData.amount}</li>
        <li><strong>Payment Method:</strong> ${transactionData.mode}</li>
        <li><strong>Transaction ID:</strong> ${transactionData.transactionId}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>Thank you for choosing DanceKatta!</p>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('Success email sent to:', userEmail);
  } catch (error) {
    console.error('Failed to send success email:', error);
  }
};

const sendFailureEmail = async (userEmail, transactionData) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Payment Failed - DanceKatta',
    html: `
      <h2>Payment Failed</h2>
      <p>Dear ${transactionData.studentName || 'Student'},</p>
      <p>Unfortunately, your payment could not be processed.</p>
      <h3>Transaction Details:</h3>
      <ul>
        <li><strong>Studio:</strong> ${transactionData.studioName}</li>
        <li><strong>Batch:</strong> ${transactionData.batchName || 'N/A'}</li>
        <li><strong>Branch:</strong> ${transactionData.branchName || 'N/A'}</li>
        <li><strong>Amount:</strong> ₹${transactionData.amount}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>Please try again or contact support.</p>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('Failure email sent to:', userEmail);
  } catch (error) {
    console.error('Failed to send failure email:', error);
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
  try {
    // ✅ All fields destructured including batchName and branchName
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      studentName,    // ✅
      batchId,
      batchName,      // ✅ ADDED
      branchName,     // ✅ ADDED
      studioName,
      userEmail,
      amount,
      couponCode,
      discountAmount,
      discountPercent,
    } = req.body;

    // Debug log — remove in production
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

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Fetch actual payment method from Razorpay
      let paymentMethod = 'Unknown';
      try {
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        paymentMethod = payment.method;
      } catch (e) {
        console.log('Failed to fetch payment method:', e.message);
      }


      // 🔥 Fetch actual data from DB (source of truth)
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
        console.log("Snapshot fetch error:", err.message);
      }
      const studentNameFinal = user?.name || studentName || "Unknown";
      const studentEmailFinal = user?.email || userEmail || "Unknown";

      const batchNameFinal = batch?.batchName || batchName || "Unknown Batch";
      const branchNameFinal = branch?.name || branchName || "Unknown Branch";

      // ✅ Save transaction with ALL fields
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
      console.log('Transaction saved:', transaction._id);

      // Add student to batch enrolled_students
      try {
        await mongoose.connection.db.collection('batches').updateOne(
          { _id: new mongoose.Types.ObjectId(batchId) },
          { $addToSet: { enrolled_students: new mongoose.Types.ObjectId(studentId) } }
        );
        console.log('Student added to batch enrolled_students');
      } catch (e) {
        console.error('Failed to update batch enrolled_students:', e.message);
      }

      // Add batch to user enrolled_batches
      try {
        await mongoose.connection.db.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(studentId) },
          { $addToSet: { enrolled_batches: new mongoose.Types.ObjectId(batchId) } }
        );
        console.log('Batch added to user enrolled_batches');
      } catch (e) {
        console.error('Failed to update user enrolled_batches:', e.message);
      }

      // Send success email
      if (userEmail) {
        await sendSuccessEmail(userEmail, {
          studentName: studentNameFinal,
          studioName: studioName || 'Unknown Studio',
          batchName: batchNameFinal,
          branchName: branchNameFinal,
          amount,
          mode: paymentMethod,
          transactionId: razorpay_payment_id,
        });
      }

      res.json({
        success: true,
        message: 'Payment verified and transaction saved',
        payment_id: razorpay_payment_id,
        transaction_id: transaction._id,
      });

    } else {
      // Signature mismatch — send failure email
      if (userEmail) {
        await sendFailureEmail(userEmail, {
          studentName: studentNameFinal,
          studioName: studioName || 'Unknown Studio',
          batchName: batchNameFinal,
          branchName: branchNameFinal,
          amount,
        });
      }
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

  } catch (error) {
    console.error('verify-payment error:', error);
    res.status(500).json({ success: false, message: 'Verification error', error: error.message });
  }
});

// Webhook
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
