import { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

function SkeletonBar({ width, delay = 0, textColor }: { width: number | string; delay?: number; textColor: string }) {
  const shimmer = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmer, { toValue: 1, duration: 1000, delay, useNativeDriver: true }),
        RNAnimated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.12],
  });

  return (
    <RNAnimated.View
      style={{
        height: 14,
        width: width as any,
        backgroundColor: textColor,
        borderRadius: 7,
        opacity,
        marginBottom: 8,
      }}
    />
  );
}

export function SkeletonLoader() {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          gap: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}>
          <RNAnimated.View style={{
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: colors.text,
            opacity: 0.06,
          }} />
          <View style={{ flex: 1 }}>
            <SkeletonBar width={`${70 - i * 10}%`} delay={i * 100} textColor={colors.text} />
            <SkeletonBar width={`${40 - i * 5}%`} delay={i * 100 + 50} textColor={colors.text} />
          </View>
        </View>
      ))}
    </View>
  );
}
