import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Reverse geocoding utility to get precise location names
export async function getPreciseLocation(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }

    const data = await response.json();
    const address = data.address;

    // Build a precise location string
    const parts = [];

    // Add specific location names if available
    if (address.university || address.college || address.school) {
      parts.push(address.university || address.college || address.school);
    }

    if (address.neighbourhood || address.suburb) {
      parts.push(address.neighbourhood || address.suburb);
    }

    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village);
    }

    if (address.state || address.province) {
      parts.push(address.state || address.province);
    }

    if (address.country) {
      parts.push(address.country);
    }

    // If we have specific location info, use it
    if (parts.length > 0) {
      return parts.join(', ');
    }

    // Fallback to display name from OpenStreetMap
    return data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  } catch (error) {
    console.error('Error getting precise location:', error);
    // Fallback to coordinates
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}
