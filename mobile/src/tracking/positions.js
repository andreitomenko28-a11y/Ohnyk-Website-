// Pure batch shaping, deliberately free of native imports so it can be tested
// and exercised outside a device runtime (locationTask.js pulls in
// expo-location and expo-task-manager, which only resolve inside React Native).

// The endpoint caps a batch at 50 positions.
const MAX_BATCH = 50;

// Maps an expo-location batch into the POST /courier/location payload,
// dropping entries without usable coordinates and keeping the newest 50.
export function toPositions(locations = []) {
  return locations
    .filter(
      (l) =>
        l?.coords &&
        Number.isFinite(l.coords.latitude) &&
        Number.isFinite(l.coords.longitude),
    )
    .slice(-MAX_BATCH)
    .map((l) => ({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      at: new Date(l.timestamp ?? Date.now()).toISOString(),
    }));
}
