import { format } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Service to send WhatsApp reminders.
 * Supports both manual (wa.me) and automated (UltraMsg API) sending.
 */
export const sendWhatsAppReminder = async (
  phoneNumber: string,
  ownerName: string,
  plateNumber: string,
  expiryType: string,
  expiryDate: string
) => {
  let formattedDate = expiryDate;
  try {
    const dateObj = new Date(expiryDate);
    if (!isNaN(dateObj.getTime())) {
      formattedDate = format(dateObj, 'd/M/yyyy');
    }
  } catch (e) {
    // Keep original string if formatting fails
  }
  const typeLabel = expiryType.toLowerCase().includes('date') ? expiryType : `${expiryType} Date`;
  
  const message = `Dear ${ownerName.toUpperCase()},\nyour ${typeLabel} for vehicle ${plateNumber.toUpperCase()} is expiring on ${formattedDate}.\nPlease renew it immediately.\n\nArul Jothi Auto Consulting\nM .SUNDAR\n( 7373531010)`;

  // Check for WhatsApp API settings in Firestore
  let instanceId = '';
  let token = '';

  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'vahan_config'));
    if (settingsDoc.exists()) {
      instanceId = settingsDoc.data().whatsappInstanceId;
      token = settingsDoc.data().whatsappToken;
    }
  } catch (e) {
    console.error('Error fetching WhatsApp settings:', e);
  }

  // If API settings exist, try sending automatically
  if (instanceId && token) {
    try {
      const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          token: token,
          to: phoneNumber.replace(/\D/g, ''),
          body: message
        })
      });

      const data = await response.json();
      if (data.sent === 'true' || data.success) {
        return { success: true, automated: true };
      }
    } catch (error) {
      console.error('WhatsApp API Error:', error);
    }
  }

  // Fallback: Generate a WhatsApp Click-to-Chat link for manual sending
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodedMessage}`;

  return { success: true, automated: false, url: whatsappUrl };
};

/**
 * Checks if a phone number is registered on WhatsApp using UltraMsg API.
 * Returns true if the number is valid, false otherwise.
 * If API is not configured, returns true (assumes valid to avoid blocking).
 */
export const checkWhatsAppNumber = async (phoneNumber: string): Promise<{ isValid: boolean; error?: string }> => {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Basic format check
  if (cleanNumber.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits.' };
  }

  // Check for WhatsApp API settings in Firestore
  let instanceId = '';
  let token = '';

  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'vahan_config'));
    if (settingsDoc.exists()) {
      instanceId = settingsDoc.data().whatsappInstanceId;
      token = settingsDoc.data().whatsappToken;
    }
  } catch (e) {
    console.error('Error fetching WhatsApp settings:', e);
  }

  // If API settings exist, check via UltraMsg
  if (instanceId && token) {
    try {
      const response = await fetch(`https://api.ultramsg.com/${instanceId}/contacts/check?token=${token}&chatId=${cleanNumber}@c.us`);
      const data = await response.json();
      
      // UltraMsg check endpoint returns status: "valid" or "invalid"
      if (data.status === 'invalid') {
        return { isValid: false, error: 'This is not a registered WhatsApp number.' };
      }
      return { isValid: true };
    } catch (error) {
      console.error('WhatsApp Check Error:', error);
      // If API fails, we don't block the user
      return { isValid: true };
    }
  }

  // If no API configured, we can't verify, so we assume it's okay but warn in console
  return { isValid: true };
};
