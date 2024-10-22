const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const Sentiment = require('sentiment'); // Import the Sentiment library
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/checkoutDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define User schema and model
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true }, // Unique email
    password: String, // Store password as plain text
});

const User = mongoose.model('User', userSchema);

// Define Order schema and model
const orderSchema = new mongoose.Schema({
    name: String, // Reviewer's name
    email: String,
    address: String,
    productName: String,
    productPrice: Number,
    productImage: String,
    reviews: [{ // Array to store reviews
        reviewText: String,
        sentiment: String, // Add sentiment to review
    }],
});

const Order = mongoose.model('Order', orderSchema);

// API endpoint to register a new user
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    const user = new User({ name, email, password });
    try {
        await user.save();
        res.status(201).json({ success: true, message: 'User registered successfully!' });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Error registering user: ' + err.message });
    }
});

// API endpoint to login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && user.password === password) {
        res.json({ success: true, message: 'Login successful', user });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// API endpoint to save order
app.post('/api/orders', (req, res) => {
    const order = new Order(req.body);
    order.save()
        .then(() => res.status(201).send('Order saved successfully!'))
        .catch(err => res.status(400).send('Error saving order: ' + err.message));
});

// API endpoint to get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find(); // Fetch all orders from the database
        res.json({ success: true, orders }); // Return the orders
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching orders: ' + err.message });
    }
});

// API endpoint to submit a review
app.post('/api/reviews', async (req, res) => {
    const { orderId, reviewText } = req.body;

    // Initialize the Sentiment library
    const sentiment = new Sentiment();
    const sentimentResult = sentiment.analyze(reviewText);
    let sentimentLabel;

    // Determine sentiment based on the score
    if (sentimentResult.score > 0) {
        sentimentLabel = 'Likely to be Real'; // Positive sentiment
    } else if (sentimentResult.score < 0) {
        sentimentLabel = 'Likely to be Fake'; // Negative sentiment
    } else {
        sentimentLabel = 'Neutral'; // Neutral sentiment
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.reviews.push({ reviewText, sentiment: sentimentLabel }); // Save the sentiment label with the review
        await order.save();

        res.json({ success: true, message: 'Review submitted successfully!', sentiment: sentimentLabel });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error submitting review: ' + err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
