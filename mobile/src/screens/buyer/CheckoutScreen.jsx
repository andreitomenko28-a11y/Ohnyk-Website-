// Checkout: delivery method, address, time slot, note → creates the order and
// hands off to payment.
//
// The order is created as AWAITING_PAYMENT; nothing reaches the cook until the
// payment succeeds, so leaving this screen mid-flow is safe.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { createOrder, fetchAddresses, fetchCartTotal, fetchDeliverySlots } from '../../api/buyer.js';
import { checkoutIsReady, DELIVERY_METHODS } from '../../api/checkoutPayload.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

export default function CheckoutScreen({ navigation }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  const [deliveryMethod, setDeliveryMethod] = useState('COURIER');
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [addressText, setAddressText] = useState('');
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState([]);
  const [scheduledFor, setScheduledFor] = useState(null);
  const [totals, setTotals] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAddresses()
      .then((list) => {
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) setAddressId(preferred.id);
      })
      .catch(() => setAddresses([]));
    fetchDeliverySlots()
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]));
    fetchCartTotal()
      .then(setTotals)
      .catch((err) => setError(apiError(err)));
  }, []);

  async function onSubmit() {
    setBusy(true);
    setError('');
    try {
      const order = await createOrder({ addressId, addressText, note, scheduledFor, deliveryMethod });
      navigation.replace('Payment', { orderId: order.id });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = checkoutIsReady({ deliveryMethod, addressId, addressText });

  return (
    <Screen title={t('checkout')}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.muted }]}>{t('deliveryMethod')}</Text>
        <View style={styles.chips}>
          {DELIVERY_METHODS.map((m) => {
            const active = deliveryMethod === m;
            return (
              <Pressable
                key={m}
                onPress={() => setDeliveryMethod(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.ember : colors.line,
                    backgroundColor: active ? `${colors.ember}14` : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? colors.ember : colors.muted, fontSize: 13 }}>
                  {t(`delivery_${m}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {deliveryMethod !== 'PICKUP' ? (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>{t('deliveryAddress')}</Text>
            {addresses.map((a) => {
              const active = addressId === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setAddressId(a.id);
                    setAddressText('');
                  }}
                  style={[
                    styles.addressCard,
                    {
                      borderColor: active ? colors.ember : colors.line,
                      backgroundColor: active ? `${colors.ember}0d` : colors.surface,
                    },
                  ]}
                >
                  <Text style={{ color: colors.fg, fontSize: 14 }}>
                    {`${a.city}, ${a.street}, ${a.building}${a.apartment ? `, кв. ${a.apartment}` : ''}`}
                  </Text>
                </Pressable>
              );
            })}
            <Field
              label={addresses.length ? t('orEnterAddress') : t('deliveryAddress')}
              placeholder={t('addressPlaceholder')}
              value={addressText}
              onChangeText={(v) => {
                setAddressText(v);
                if (v.trim()) setAddressId(null);
              }}
            />
          </>
        ) : (
          <Text style={[styles.hint, { color: colors.muted }]}>{t('pickupHint')}</Text>
        )}

        {slots.length ? (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>{t('deliveryTime')}</Text>
            <View style={styles.chips}>
              <Pressable
                onPress={() => setScheduledFor(null)}
                style={[
                  styles.chip,
                  {
                    borderColor: scheduledFor === null ? colors.ember : colors.line,
                    backgroundColor: scheduledFor === null ? `${colors.ember}14` : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: scheduledFor === null ? colors.ember : colors.muted, fontSize: 13 }}>
                  {t('asSoonAsPossible')}
                </Text>
              </Pressable>
              {slots.map((s) => {
                const value = s.value ?? s.at ?? s;
                const label = s.label ?? new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                const active = scheduledFor === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setScheduledFor(value)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? colors.ember : colors.line,
                        backgroundColor: active ? `${colors.ember}14` : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: active ? colors.ember : colors.muted, fontSize: 13 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Field label={t('orderNote')} value={note} onChangeText={setNote} multiline />

        {totals ? (
          <View style={[styles.totals, { borderTopColor: colors.line }]}>
            <Row label={t('subtotal')} value={`${totals.subtotal} ₴`} colors={colors} />
            {totals.serviceFee ? <Row label={t('serviceFee')} value={`${totals.serviceFee} ₴`} colors={colors} /> : null}
            <Row label={t('total')} value={`${totals.total} ₴`} colors={colors} strong />
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

        <Button
          title={t('payBtn')}
          onPress={onSubmit}
          busy={busy}
          style={!ready ? styles.disabled : null}
        />
        {!ready ? <Text style={[styles.hint, { color: colors.muted }]}>{t('addressRequired')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, colors, strong }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={{ color: strong ? colors.fg : colors.muted, fontSize: strong ? 15 : 13.5, fontWeight: strong ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: colors.fg, fontSize: strong ? 18 : 14, fontWeight: strong ? '800' : '600' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  label: { fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addressCard: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  hint: { fontSize: 12.5, marginBottom: spacing.lg, textAlign: 'center' },
  totals: { borderTopWidth: 1, paddingTop: spacing.md, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  disabled: { opacity: 0.5 },
});
