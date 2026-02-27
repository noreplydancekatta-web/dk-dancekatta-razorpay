// Quick test script to verify Razorpay backend
const http = require('http');

// Test health endpoint
const testHealth = () => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ Health Check:', JSON.parse(data));
      testCreateOrder();
    });
  });

  req.on('error', (err) => {
    console.log('❌ Health Check Failed:', err.message);
  });

  req.end();
};

// Test create order endpoint
const testCreateOrder = () => {
  const postData = JSON.stringify({ amount: 100 });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/create-order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ Create Order:', JSON.parse(data));
    });
  });

  req.on('error', (err) => {
    console.log('❌ Create Order Failed:', err.message);
  });

  req.write(postData);
  req.end();
};

console.log('🧪 Testing Razorpay Backend...');
setTimeout(testHealth, 2000); // Wait 2 seconds for server to start