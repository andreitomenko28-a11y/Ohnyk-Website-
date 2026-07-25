// Payment via MonoPay.
//
// MonoPay is a hosted invoice page, not a mobile SDK, so the payment happens in
// a WebView. Two things matter:
//
//   • The redirect back is only a *hint*. The authoritative signal is the
//     provider's server-to-server webhook, which may land before or after the
//     browser returns — so the screen polls GET /orders/:id/payment rather than
//     trusting the redirect.
//   • In stub mode (no MONO_TOKEN) the returned pageUrl points at the *web*
//     frontend, which isn't reachable as a payment flow from the app. There the
//     screen offers the dev-only mock endpoint instead of a dead WebView.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { fetchPaymentStatus, initPayment, mockCompletePayment } from '../../api/buyer.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

const POLL_MS = 2500;
// Give the webhook time to arrive after the buyer finishes on the hosted page.
const POLL_LIMIT = 40; // ~100s

// The order leaves AWAITING_PAYMENT only once payment succeeded.
const isPaid = (s) => s?.orderStatus && s.orderStatus !== 'AWAITING_PAYMENT';
const isFailed = (s) => s?.payment?.status === 'FAILED';

export default function PaymentScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { t } = useI18n();
  const { colors } = useTheme();

  const [invoice, setInvoice] = useState(null); // { pageUrl, stub }
  const [status, setStatus] = useState(null);
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pollCount = useRef(0);

  useEffect(() => {
    initPayment(orderId)
      .then(setInvoice)
      .catch((err) => setError(apiError(err)));
  }, [orderId]);

  const check = useCallback(async () => {
    try {
      const s = await fetchPaymentStatus(orderId);
      setStatus(s);
      return s;
    } catch (err) {
      setError(apiError(err));
      return null;
    }
  }, [orderId]);

  // Poll until the order moves off AWAITING_PAYMENT, the payment fails, or we
  // give up and let the buyer check their orders later.
  useEffect(() => {
    if (!polling) return undefined;
    const id = setInterval(async () => {
      pollCount.current += 1;
      const s = await check();
      if (isPaid(s) || isFailed(s) || pollCount.current >= POLL_LIMIT) {
        setPolling(false);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [polling, check]);

  async function onMockPay() {
    setBusy(true);
    setError('');
    try {
      await mockCompletePayment(orderId, 'success');
      await check();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  // --- terminal states ------------------------------------------------------
  if (isPaid(status)) {
    return (
      <Screen title={t('paymentDone')}>
        <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.resultTitle, { color: colors.fg }]}>{t('paymentSuccess')}</Text>
          <Text style={[styles.resultMeta, { color: colors.muted }]}>
            {status.cookName ? `${status.cookName} · ` : ''}
            {status.total} ₴
          </Text>
        </View>
        <Button title={t('toOrders')} onPress={() => navigation.navigate('Orders')} />
      </Screen>
    );
  }

  if (isFailed(status)) {
    return (
      <Screen title={t('paymentTitle')}>
        <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.resultTitle, { color: colors.ember }]}>{t('paymentFailed')}</Text>
        </View>
        <Button
          title={t('retry')}
          onPress={() => {
            setStatus(null);
            pollCount.current = 0;
            initPayment(orderId).then(setInvoice).catch((err) => setError(apiError(err)));
          }}
        />
      </Screen>
    );
  }

  if (error && !invoice) {
    return (
      <Screen title={t('paymentTitle')}>
        <Text style={[styles.error, { color: colors.ember }]}>{error}</Text>
        <Button title={t('toOrders')} variant="ghost" onPress={() => navigation.navigate('Orders')} />
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen title={t('paymentTitle')}>
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      </Screen>
    );
  }

  // --- stub mode: no real gateway to show -----------------------------------
  if (invoice.stub) {
    return (
      <Screen title={t('paymentTitle')}>
        <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.resultTitle, { color: colors.fg }]}>{t('paymentStubTitle')}</Text>
          <Text style={[styles.resultMeta, { color: colors.muted }]}>{t('paymentStubHint')}</Text>
        </View>
        {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}
        <Button title={t('paymentStubPay')} onPress={onMockPay} busy={busy} />
      </Screen>
    );
  }

  // --- real MonoPay hosted page ---------------------------------------------
  return (
    <Screen title={t('paymentTitle')} edges={['top']}>
      <View style={styles.webWrap}>
        <WebView
          source={{ uri: invoice.pageUrl }}
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={colors.ember} style={styles.loader} />}
          // The redirect back is a hint that the buyer finished; the webhook is
          // what actually settles the order, so this only starts polling.
          onNavigationStateChange={(nav) => {
            if (nav.url?.includes(`/pay/${orderId}`)) setPolling(true);
          }}
        />
      </View>
      {polling ? (
        <View style={styles.pollBar}>
          <ActivityIndicator color={colors.ember} size="small" />
          <Text style={{ color: colors.muted, fontSize: 13, marginLeft: spacing.sm }}>
            {t('paymentChecking')}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  webWrap: { flex: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.md },
  pollBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.md },
  result: { borderWidth: 1, borderRadius: radius.card, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  resultTitle: { fontSize: 17, fontWeight: '700' },
  resultMeta: { fontSize: 13.5, marginTop: spacing.sm, textAlign: 'center' },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
});
