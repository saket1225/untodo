import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, Fonts } from '../../lib/theme';
import { useUserStore } from '../../engines/user/store';
import { startSiliconListener } from '../../engines/silicon/bridge';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    'Today': '◉',
    'Progress': '◧',
    'Wallpaper': '◫',
    'Settings': '⚙',
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={[
        styles.icon,
        { color: focused ? Colors.dark.accent : Colors.dark.textTertiary },
        focused && styles.iconFocused,
      ]}>
        {icons[label] || '●'}
      </Text>
      <Text style={[styles.label, {
        color: focused ? Colors.dark.accent : Colors.dark.textTertiary,
        fontFamily: focused ? Fonts.bodyMedium : Fonts.body,
      }]}>
        {label}
      </Text>
    </View>
  );
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
        sceneStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Progress" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wallpaper"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Wallpaper" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.dark.surface,
    borderTopColor: Colors.dark.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingBottom: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 2,
  },
  icon: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
    fontSize: 22,
  },
  label: {
    fontSize: 11,
  },
});
