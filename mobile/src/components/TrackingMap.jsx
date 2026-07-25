// Map with OpenStreetMap tiles.
//
// Tiles come from OSM rather than Google so there is no API key, no billing
// account and no quota — the same choice the web build made with Leaflet, which
// also keeps the two clients looking alike.
//
// `mapType="none"` is required: without it the platform's own basemap renders
// underneath the OSM tiles. On iOS that means Apple Maps showing through.

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '../theme/ThemeContext.jsx';

// OSM's usage policy asks for a real User-Agent and discourages heavy use of
// the public tile servers; swap in a paid tile host before scaling up.
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAX_ZOOM = 19;

// Cherkasy — where the MVP launches, and a sane view before any fix arrives.
const FALLBACK = { latitude: 49.4444, longitude: 32.0598 };

export default function TrackingMap({ courier, destination, style }) {
  const { colors } = useTheme();
  const mapRef = useRef(null);

  const center = courier ?? destination ?? FALLBACK;

  // Follow the courier as new positions arrive, but animate rather than jump
  // so the movement reads as movement.
  useEffect(() => {
    if (!courier || !mapRef.current) return;
    mapRef.current.animateCamera(
      { center: { latitude: courier.latitude, longitude: courier.longitude } },
      { duration: 700 },
    );
  }, [courier?.latitude, courier?.longitude]);

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        // Without this the native basemap renders under the OSM tiles.
        mapType="none"
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <UrlTile urlTemplate={OSM_TILES} maximumZ={MAX_ZOOM} flipY={false} />

        {destination ? (
          <Marker
            coordinate={destination}
            title="Адреса доставки"
            pinColor={colors.emberDark}
          />
        ) : null}

        {courier ? (
          <Marker coordinate={courier} title="Курʼєр">
            <View style={[styles.courierDot, { backgroundColor: colors.ember, borderColor: colors.onAccent }]} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  courierDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
});
