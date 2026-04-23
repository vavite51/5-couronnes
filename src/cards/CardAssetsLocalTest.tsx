import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

type LocalTestCard = {
  cardId: string;
  source: ImageSourcePropType;
};

const TEST_CARDS: ReadonlyArray<LocalTestCard> = [
  { cardId: 'clubs_A', source: require('../../assets/cards/clubs_a.png') },
  { cardId: 'hearts_5', source: require('../../assets/cards/hearts_5.png') },
  { cardId: 'spades_10', source: require('../../assets/cards/spades_10.png') },
  { cardId: 'diamonds_Q', source: require('../../assets/cards/diamonds_q.png') },
  { cardId: 'stars_K', source: require('../../assets/cards/stars_k.png') },
];

export function CardAssetsLocalTest() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Test Local Cartes (5)</Text>
      <View style={styles.grid}>
        {TEST_CARDS.map((card) => (
          <View key={card.cardId} style={styles.cardCell}>
            <Image source={card.source} style={styles.cardImage} resizeMode="contain" />
            <Text style={styles.cardLabel}>{card.cardId}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  cardCell: {
    width: '48%',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 5 / 7,
    maxHeight: 210,
  },
  cardLabel: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
});
