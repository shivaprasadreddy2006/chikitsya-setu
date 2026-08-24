const axios = require('axios');

/**
 * Send real SMS to any Indian mobile number via Fast2SMS
 * @param {string} phoneNumber - 10-digit Indian phone number
 * @param {string} messageText - Text content to send
 */
async function sendRealFast2SMS(phoneNumber, messageText) {
    if (!phoneNumber) return { success: false, reason: 'No phone number provided' };

    // Clean number to 10 digits
    const cleanedNumber = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey || apiKey.includes('paste_your_key_here')) {
        console.warn('\n⚠️ [FAST2SMS WARNING]: FAST2SMS_API_KEY is not configured in .env yet.');
        console.log(`Simulated SMS to +91 ${cleanedNumber}:\n${messageText}\n`);
        return { success: false, reason: 'API key not configured' };
    }

    try {
        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            route: 'q', // Quick transactional SMS route
            message: messageText,
            language: 'english',
            flash: 0,
            numbers: cleanedNumber
        }, {
            headers: {
                'authorization': apiKey.trim(),
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.return === true) {
            console.log(`\n✅ [REAL SMS DELIVERED TO +91 ${cleanedNumber}] Request ID: ${response.data.request_id}\n`);
            return { success: true, requestId: response.data.request_id, response: response.data };
        } else {
            console.warn('⚠️ Fast2SMS Response:', response.data);
            return { success: false, response: response.data };
        }
    } catch (error) {
        console.error('❌ [FAST2SMS ERROR]:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

module.exports = { sendRealFast2SMS };
