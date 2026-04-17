import { Vehicle } from '../types';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Service to handle automatic vehicle data synchronization via third-party APIs.
 * To use this, you need an API key from a provider like RapidAPI or DigitAP.
 */
export async function syncVehicleWithApi(vehicle: Vehicle) {
  const meta = import.meta as any;
  let apiKey = meta.env.VITE_VAHAN_API_KEY;
  
  // If not in env, check Firestore settings
  if (!apiKey || apiKey === 'your_api_key_here') {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'vahan_config'));
      if (settingsDoc.exists()) {
        apiKey = settingsDoc.data().vahanApiKey;
      }
    } catch (e) {
      console.error('Error fetching API key from Firestore:', e);
    }
  }
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('VAHAN_API_KEY_MISSING');
  }

  try {
    // This implementation uses a standard structure common among Indian RTO API providers
    // (e.g., DigitAP, RapidAPI RTO, etc.)
    const response = await fetch(`https://api.digitap.ai/v1/vehicle/${vehicle.plateNumber}`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }

    if (!response.ok) {
      throw new Error('API_FETCH_FAILED');
    }

    const result = await response.json();
    const data = result.data || result;

    // Mapping the API response to our database fields
    // We try multiple common field names used by different providers
    const updates: Partial<Vehicle> = {
      fcExpiry: data.fitness_upto || data.fc_expiry || data.fitness_expiry || vehicle.fcExpiry,
      permitExpiry: data.permit_upto || data.permit_expiry || data.permit_valid_upto || vehicle.permitExpiry,
      insuranceExpiry: data.insurance_upto || data.insurance_expiry || data.insurance_valid_upto || vehicle.insuranceExpiry,
      nationalPermitExpiry: data.np_upto || data.np_expiry || data.np_valid_upto || vehicle.nationalPermitExpiry,
      lastSync: new Date().toISOString()
    };

    if (vehicle.id) {
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      await updateDoc(vehicleRef, updates);
    }

    return updates;
  } catch (error) {
    console.error('Vahan Sync Error:', error);
    throw error;
  }
}
