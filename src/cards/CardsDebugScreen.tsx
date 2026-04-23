import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CARD_ASSET_CHECKLIST,
  CARD_ASSET_SPECS,
  CARD_ASSET_SUIT_COUNTS,
  getCardAssetsByTemplateType,
  getPendingCardAssets,
} from './asset-specs';

export function CardsDebugScreen() {
  const total = CARD_ASSET_SPECS.length;
  const pending = getPendingCardAssets().length;
  const numbers = getCardAssetsByTemplateType('number_card').length;
  const faces = getCardAssetsByTemplateType('face_card').length;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Debug Cartes - Production Assets</Text>
      <Text style={styles.kpi}>Total: {total}</Text>
      <Text style={styles.kpi}>Pending: {pending}</Text>
      <Text style={styles.kpi}>Numerales: {numbers}</Text>
      <Text style={styles.kpi}>Figures: {faces}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comptage par famille</Text>
        <Text style={styles.row}>Clubs: {CARD_ASSET_SUIT_COUNTS.clubs}</Text>
        <Text style={styles.row}>Diamonds: {CARD_ASSET_SUIT_COUNTS.diamonds}</Text>
        <Text style={styles.row}>Hearts: {CARD_ASSET_SUIT_COUNTS.hearts}</Text>
        <Text style={styles.row}>Spades: {CARD_ASSET_SUIT_COUNTS.spades}</Text>
        <Text style={styles.row}>Stars: {CARD_ASSET_SUIT_COUNTS.stars}</Text>
      </View>

      <Text style={styles.sectionTitle}>Checklist ({CARD_ASSET_CHECKLIST.length})</Text>
      <ScrollView style={styles.list}>
        {CARD_ASSET_CHECKLIST.map((item) => (
          <View key={item.cardId} style={styles.listItem}>
            <Text style={styles.listText}>
              {item.cardId} | {item.assetFileName} | {item.templateType} | {item.productionStatus}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  kpi: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  section: {
    marginTop: 10,
    marginBottom: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  row: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  list: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  listText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
  },
});
