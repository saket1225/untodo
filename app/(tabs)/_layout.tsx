import { useEffect, useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts } from '../../lib/theme';
import { useUserStore } from '../../engines/user/store';
import { useTodoStore } from '../../engines/todo/store';
import { getLogicalDate } from '../../lib/date-utils';
import { startSiliconListener } from '../../engines/silicon/bridge';

function TabIcon({ label, focused, badge }: { label: string; focused: boolean; badge?: number }) {
  const icons: Record<string, string> = {
    'Today': '◉',
    'Stats': '◧',
    'Wallpaper': '◫',
    'Settings': '⚙',
  };
  return (
    <View style={styles.tabIcon}>
      <View style={styles.iconContainer}>
        <Text style={[
          styles.icon,
          { color: focused ? Colors.dark.accent : Colors.dark.textTertiary },
          focused && styles.iconFocused,
        ]}>
          {icons[label] || '●'}
        </Text>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, {
          color: focused ? Colors.dark.accent : Colors.dark.textTertiary,
          fontFamily: focused ? Fonts.bodyMedium : Fonts.body,
        }]}
      >
        {label}
      </Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

function TodayTabIcon({ focused }: { focused: boolean }) {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();
  const remaining = useMemo(() => {
    return todos.filter(t => t.logicalDate === logicalDate && !t.completed).length;
  }, [todos, logicalDate]);
  return <TabIcon label="Today" focused={focused} badge={remaining} />;
}

export default function TabLayout() {
  const username = useUserStore(s => s.username);

  useEffect(() => {
    if (!username) return;
    const unsubscribe = startSiliconListener(username);
    return () => unsubscribe();
  }, [username]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        animation: 'fade',
        lazy: false,
        sceneStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TodayTabIcon focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Stats" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="wallpaper"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Wallpaper" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.dark.background,
    borderTopColor: Colors.dark.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 2,
  },
  iconContainer: {
    position: 'relative',
  },
  icon: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
    fontSize: 23,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.dark.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    lineHeight: 14,
  },
  label: {
    fontSize: 11,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.accent,
    marginTop: 2,
  },
});
