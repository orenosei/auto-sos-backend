export const toGeogPointText = (location) => {
  if (location == null) return null;

  if (typeof location === "string") {
    const trimmed = location.trim();
    if (trimmed.length === 0) return null;
    if (/^SRID=/i.test(trimmed)) return trimmed;
    if (/^POINT\s*\(/i.test(trimmed)) return `SRID=4326;${trimmed}`;
    return trimmed;
  }

  if (typeof location === "object") {
    const lat = location.lat ?? location.latitude;
    const lng = location.lng ?? location.lon ?? location.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return `SRID=4326;POINT(${lng} ${lat})`;
    }
  }

  return null;
};

export const toGeogText = toGeogPointText;
