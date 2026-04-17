import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncVehicleWithApi } from './vahanService';
import { getDoc, updateDoc } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  getFirestore: vi.fn(),
}));

// Mock Firebase DB
vi.mock('../firebase', () => ({
  db: {},
}));

describe('syncVehicleWithApi', () => {
  const mockVehicle = {
    id: 'v1',
    plateNumber: 'TN59CP4114',
    ownerName: 'John Doe',
    phoneNumber: '9876543210',
    fcExpiry: '2025-01-01',
    permitExpiry: '2025-01-01',
    insuranceExpiry: '2025-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Mock import.meta.env
    vi.stubEnv('VITE_VAHAN_API_KEY', 'test_key');
  });

  it('should throw error if API key is missing', async () => {
    vi.stubEnv('VITE_VAHAN_API_KEY', '');
    (getDoc as any).mockResolvedValue({ exists: () => false });

    await expect(syncVehicleWithApi(mockVehicle)).rejects.toThrow('VAHAN_API_KEY_MISSING');
  });

  it('should sync successfully and update database', async () => {
    const mockApiResponse = {
      fitness_upto: '2026-05-20',
      permit_upto: '2026-06-15',
      insurance_upto: '2026-12-31',
      np_upto: '2026-08-10'
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await syncVehicleWithApi(mockVehicle);

    expect(result.fcExpiry).toBe('2026-05-20');
    expect(result.permitExpiry).toBe('2026-06-15');
    expect(updateDoc).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
    });

    await expect(syncVehicleWithApi(mockVehicle)).rejects.toThrow('Failed to fetch data from Vahan API');
  });

  it('should fetch API key from Firestore if not in env', async () => {
    vi.stubEnv('VITE_VAHAN_API_KEY', '');
    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({ vahanApiKey: 'firestore_key' })
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ fitness_upto: '2026-01-01' }),
    });

    await syncVehicleWithApi(mockVehicle);
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Api-Key': 'firestore_key'
        })
      })
    );
  });
});
