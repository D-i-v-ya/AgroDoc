require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
const path = require('path');

// Create Express app
const app = express();
app.use(bodyParser.json());

// Serve static files (like login.html and verify-otp.html)
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// MongoDB connection URI from environment variables
const uri = process.env.MONGO_URI;
const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Generate OTP function
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Route to send OTP via email and store it in the database
app.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    const otp = generateOTP();
    const sentTime = new Date();

    try {
        // Setup Nodemailer transport for SMTP
        const transporter = nodemailer.createTransport({
            service: 'Gmail', // Use any SMTP service like Gmail, Outlook, etc.
            auth: {
                user: process.env.EMAIL_USER, // Email from environment variables
                pass: process.env.EMAIL_PASS  // Password from environment variables
            }
        });

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER, // Sender's email
            to: email,                    // Recipient's email
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}` // The content of the email (OTP)
        };

        // Send OTP email
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);

        // Connect to MongoDB
        await mongoClient.connect();
        const database = mongoClient.db('AgroDoc');
        const collection = database.collection('user');

        // Insert OTP and user data into the database
        const userData = {
            email: email,
            otp: otp,
            sentTime: sentTime
        };

        await collection.updateOne({ email: email }, { $set: userData }, { upsert: true });
        console.log("Data stored in MongoDB:", userData);

        res.status(200).json({ success: true, message: 'OTP sent and data stored successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'An error occurred while sending OTP or storing data' });
    } finally {
        // Close MongoDB connection
        await mongoClient.close();
    }
});

// Route to verify OTP
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Connect to MongoDB
        await mongoClient.connect();
        const database = mongoClient.db('AgroDoc');
        const collection = database.collection('user');

        // Find the user by email and check if OTP matches
        const user = await collection.findOne({ email: email });

        if (user && user.otp === otp) {
            // OTP is correct, you can now store the data in the database
            console.log("OTP verified successfully for:", email);
            res.status(200).json({ success: true, message: 'OTP verified successfully' });
        } else {
            // OTP does not match
            res.status(400).json({ success: false, message: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'An error occurred while verifying OTP' });
    } finally {
        // Close MongoDB connection
        await mongoClient.close();
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
