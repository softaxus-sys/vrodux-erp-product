require('dotenv').config();
const { connectDB } = require('./config/db');
const app       = require('./app');

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`VroduxERP Node API running on port ${PORT}`);
  });
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});
