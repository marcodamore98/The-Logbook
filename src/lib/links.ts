/** A typed web address as an openable link ("zoom.us/j/1" → "https://zoom.us/j/1"). */
export const webUrl = (s: string) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`);

/** Google Maps search for a place (opens the Maps app on the phone). */
export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`;
