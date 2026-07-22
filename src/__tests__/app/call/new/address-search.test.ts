import axios from 'axios';
import { MAPBOX_SEARCH_BIAS_PARAMS } from '@/constants/geocoding';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mapbox Geocoding API response types
interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

// Address search logic extracted for testing
const performAddressSearch = async (
  address: string,
  mapboxKey: string
): Promise<{
  success: boolean;
  results?: GeocodingResult[];
  error?: string;
}> => {
  if (!address.trim()) {
    return { success: false, error: 'Address is required' };
  }

  if (!mapboxKey) {
    return { success: false, error: 'Mapbox public key not configured' };
  }

  try {
    // Make request to the Mapbox Geocoding API
    const response = await axios.get<MapboxGeocodingResponse>(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxKey}${MAPBOX_SEARCH_BIAS_PARAMS}`);

    const results: GeocodingResult[] = response.data.features.map((feature) => ({
      formatted_address: feature.place_name,
      geometry: { location: { lat: feature.center[1], lng: feature.center[0] } },
      place_id: feature.id,
    }));

    if (results.length > 0) {
      return { success: true, results };
    } else {
      return { success: false, error: 'No results found' };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

describe('Address Search Logic', () => {
  const mockSingleFeatureResult: MapboxGeocodingResponse = {
    features: [
      {
        id: 'address.123456',
        place_name: '123 Main St, New York, NY 10001, USA',
        center: [-74.006, 40.7128],
      },
    ],
  };

  const mockMultipleFeatureResults: MapboxGeocodingResponse = {
    features: [
      {
        id: 'address.123456',
        place_name: '123 Main St, New York, NY 10001, USA',
        center: [-74.006, 40.7128],
      },
      {
        id: 'address.789012',
        place_name: '123 Main St, Brooklyn, NY 11201, USA',
        center: [-73.9442, 40.6892],
      },
    ],
  };

  const mockApiKey = 'test-mapbox-key';

  beforeEach(() => {
    jest.clearAllMocks();

    // Set default successful axios response
    mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });
  });

  describe('Input Validation', () => {
    it('should reject empty address string', async () => {
      const result = await performAddressSearch('', mockApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Address is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only address string', async () => {
      const result = await performAddressSearch('   ', mockApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Address is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('API Configuration', () => {
    it('should handle missing API key gracefully', async () => {
      const result = await performAddressSearch('123 Main St', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mapbox public key not configured');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should use correct API endpoint and parameters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });

      await performAddressSearch('123 Main St, New York', mockApiKey);

      expect(mockedAxios.get).toHaveBeenCalledWith(`https://api.mapbox.com/geocoding/v5/mapbox.places/123%20Main%20St%2C%20New%20York.json?access_token=test-mapbox-key${MAPBOX_SEARCH_BIAS_PARAMS}`);
    });
  });

  describe('Geocoding Results', () => {
    it('should handle single geocoding result', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });

      const result = await performAddressSearch('123 Main St', mockApiKey);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![0].geometry.location.lat).toBe(40.7128);
      expect(result.results![0].geometry.location.lng).toBe(-74.006);
    });

    it('should handle multiple geocoding results', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockMultipleFeatureResults });

      const result = await performAddressSearch('123 Main St', mockApiKey);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![1].formatted_address).toBe('123 Main St, Brooklyn, NY 11201, USA');
    });

    it('should handle no results from the geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({ data: { features: [] } });

      const result = await performAddressSearch('NonExistentAddress', mockApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await performAddressSearch('123 Main St', mockApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle API timeout errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await performAddressSearch('123 Main St', mockApiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Address Encoding', () => {
    it('should properly encode special characters in addresses', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });

      await performAddressSearch('123 Main St, New York & Brooklyn', mockApiKey);

      expect(mockedAxios.get).toHaveBeenCalledWith(`https://api.mapbox.com/geocoding/v5/mapbox.places/123%20Main%20St%2C%20New%20York%20%26%20Brooklyn.json?access_token=test-mapbox-key${MAPBOX_SEARCH_BIAS_PARAMS}`);
    });

    it('should handle addresses with unicode characters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });

      await performAddressSearch('123 Café Street, Montréal', mockApiKey);

      expect(mockedAxios.get).toHaveBeenCalledWith(`https://api.mapbox.com/geocoding/v5/mapbox.places/123%20Caf%C3%A9%20Street%2C%20Montr%C3%A9al.json?access_token=test-mapbox-key${MAPBOX_SEARCH_BIAS_PARAMS}`);
    });
  });

  describe('Data Structure Validation', () => {
    it('should map a Mapbox feature into the expected result structure', async () => {
      const feature: MapboxFeature = {
        id: 'address.123456',
        place_name: '123 Main St, New York, NY 10001, USA',
        center: [-74.006, 40.7128],
      };

      mockedAxios.get.mockResolvedValue({ data: { features: [feature] } });

      const result = await performAddressSearch('123 Main St', mockApiKey);

      expect(result.success).toBe(true);
      expect(result.results![0]).toEqual({
        formatted_address: '123 Main St, New York, NY 10001, USA',
        geometry: { location: { lat: 40.7128, lng: -74.006 } },
        place_id: 'address.123456',
      });
    });
  });

  describe('Integration Flow', () => {
    it('should complete entire geocoding flow successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleFeatureResult });

      // Test complete flow
      const result = await performAddressSearch('123 Main St, New York', mockApiKey);

      // Verify API was called correctly
      expect(mockedAxios.get).toHaveBeenCalledWith(`https://api.mapbox.com/geocoding/v5/mapbox.places/123%20Main%20St%2C%20New%20York.json?access_token=test-mapbox-key${MAPBOX_SEARCH_BIAS_PARAMS}`);

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![0].geometry.location.lat).toBe(40.7128);
      expect(result.results![0].geometry.location.lng).toBe(-74.006);
      expect(result.results![0].place_id).toBeDefined();

      // Verify error is not present
      expect(result.error).toBeUndefined();
    });
  });
});
