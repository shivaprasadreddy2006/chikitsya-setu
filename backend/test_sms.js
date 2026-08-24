require('dotenv').config();
const axios = require('axios');

async function testFast2SMS() {
    const apiKey = process.env.FAST2SMS_API_KEY;
    console.log('Testing Fast2SMS with API Key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'None');

    // Test Quick Route
    try {
        console.log('\n--- 1. Testing Route "q" ---');
        const res1 = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            route: 'q',
            message: 'Gandhi Hospital: Test SMS for Chikitsya Setu.',
            language: 'english',
            flash: 0,
            numbers: '9999999999' // placeholder to test response status
        }, {
            headers: { 'authorization': apiKey, 'Content-Type': 'application/json' }
        });
        console.log('Route "q" Response:', res1.data);
    } catch (err) {
        console.log('Route "q" Error:', err.response?.data || err.message);
    }

    // Test OTP Route (TRAI Approved for all Indian Numbers)
    try {
        console.log('\n--- 2. Testing Route "otp" ---');
        const res2 = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            variables_values: '582910',
            route: 'otp',
            numbers: '9999999999'
        }, {
            headers: { 'authorization': apiKey, 'Content-Type': 'application/json' }
        });
        console.log('Route "otp" Response:', res2.data);
    } catch (err) {
        console.log('Route "otp" Error:', err.response?.data || err.message);
    }
}

testFast2SMS();
