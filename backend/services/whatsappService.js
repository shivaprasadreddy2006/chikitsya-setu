const twilio = require('twilio');

// Helper to format phone number to E.164 standard (defaulting to +91 for India if no country code provided)
function formatToWhatsAppNumber(phone) {
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
        // If 10-digit Indian number, add +91
        if (cleaned.length === 10) {
            cleaned = `+91${cleaned}`;
        } else {
            cleaned = `+${cleaned}`;
        }
    }
    return `whatsapp:${cleaned}`;
}

async function sendRealWhatsAppMessage(toPhone, messageBody) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio default sandbox number

    // If keys are missing, log clearly
    if (!accountSid || !authToken || accountSid.includes('your_account_sid')) {
        console.warn('\n⚠️ [TWILIO WARNING]: Twilio keys not configured in backend/.env yet.');
        console.warn(`Message meant for ${toPhone}:\n${messageBody}\n`);
        return { success: false, reason: 'Twilio keys not set in .env' };
    }

    try {
        const client = twilio(accountSid, authToken);
        const recipient = formatToWhatsAppNumber(toPhone);

        const response = await client.messages.create({
            body: messageBody,
            from: fromWhatsAppNumber,
            to: recipient
        });

        console.log(`\n✅ [REAL WHATSAPP DELIVERED] SID: ${response.sid} to ${recipient}\n`);
        return { success: true, sid: response.sid };
    } catch (error) {
        console.error('❌ [TWILIO WHATSAPP ERROR]:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendRealWhatsAppMessage };
