import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Modal, TouchableOpacity, ScrollView,
  Animated as RNAnimated, RefreshControl, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, formatDisplayDate, shiftDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import QuickActions from '../../engines/todo/components/QuickActions';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Todo, Category, CATEGORIES, Priority } from '../../engines/todo/types';
import { onSyncStateChange } from '../../lib/firebase-sync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 72; // Approximate fixed height for getItemLayout

const MORNING_MSGS = [
  'What will you conquer today?',
  'Make today count.',
  'Do the hard thing first.',
  'Today is yours.',
  'Build momentum early.',
];
const AFTERNOON_MSGS = [
  'Stay locked in.',
  'Focus on what matters.',
  'One task at a time.',
  'Keep the momentum.',
  'Ship something today.',
];
const EVENING_MSGS = [
  'Wrap up strong.',
  'Small steps, big results.',
  'Progress over perfection.',
  'Finish what you started.',
  'Almost there.',
];
const NIGHT_MSGS = [
  'Night owl mode.',
  'Rest is productive too.',
  'Consistency beats intensity.',
  'Discipline is freedom.',
  'Tomorrow starts with tonight.',
];

function getTimeBasedGreeting(): { prefix: string; message: string } {
  const hour = new Date().getHours();
  const dayOfYear = Math.floor(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  if (hour < 12) {
    return { prefix: 'Good morning', message: MORNING_MSGS[dayOfYear % MORNING_MSGS.length] };
  } else if (hour < 17) {
    return { prefix: 'Good afternoon', message: AFTERNOON_MSGS[dayOfYear % AFTERNOON_MSGS.length] };
  } else if (hour < 21) {
    return { prefix: 'Good evening', message: EVENING_MSGS[dayOfYear % EVENING_MSGS.length] };
  } else {
    return { prefix: 'Night owl mode', message: NIGHT_MSGS[dayOfYear % NIGHT_MSGS.length] };
  }
}

function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m remaining`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m remaining` : `${h}h remaining`;
}

// --- Confetti Celebration Component ---
function ConfettiCelebration({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      x: new RNAnimated.Value(SCREEN_WIDTH / 2),
      y: new RNAnimated.Value(400),
      opacity: new RNAnimated.Value(1),
      color: ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#F5F5F5'][i % 6],
      targetX: Math.random() * SCREEN_WIDTH,
      targetY: Math.random() * -200 + 100,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    // Fade in
    RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Animate particles
    particles.forEach((p) => {
      p.x.setValue(SCREEN_WIDTH / 2);
      p.y.setValue(400);
      p.opacity.setValue(1);
      RNAnimated.parallel([
        RNAnimated.timing(p.x, { toValue: p.targetX, duration: 1200, useNativeDriver: true }),
        RNAnimated.sequence([
          RNAnimated.timing(p.y, { toValue: p.targetY, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(p.y, { toValue: 800, duration: 600, useNativeDriver: true }),
        ]),
        RNAnimated.timing(p.opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]).start();
    });
    // Auto-dismiss after 3 seconds
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <RNAnimated.View style={[styles.confettiOverlay, { opacity }]} pointerEvents="none">
      {particles.map((p, i) => (
        <RNAnimated.View
          key={i}
          style={[
            styles.confettiParticle,
            {
              backgroundColor: p.color,
              width: i % 3 === 0 ? 8 : 6,
              height: i % 3 === 0 ? 8 : 6,
              borderRadius: i % 2 === 0 ? 4 : 1,
              transform: [{ translateX: p.x }, { translateY: p.y }],
              opacity: p.opacity,
            },
          ]}
        />
      ))}
      <View style={styles.celebrationTextContainer}>
        <Text style={styles.celebrationText}>All done! You crushed it.</Text>
      </View>
    </RNAnimated.View>
  );
}

// --- Search Results Component ---
function SearchResults({
  query,
  results,
  onSelect,
  onClose,
}: {
  query: string;
  results: Todo[];
  onSelect: (todo: Todo) => void;
  onClose: () => void;
}) {
  if (!query.trim() || results.length === 0) {
    if (query.trim()) {
      return (
        <View style={styles.searchResults}>
          <Text style={styles.searchNoResults}>No tasks found</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.searchResults}>
      <ScrollView style={styles.searchScroll} keyboardShouldPersistTaps="handled">
        {results.slice(0, 15).map((todo) => (
          <TouchableOpacity
            key={todo.id}
            style={styles.searchResultItem}
            onPress={() => onSelect(todo)}
          >
            <View style={styles.searchResultContent}>
              <Text
                style={[styles.searchResultTitle, todo.completed && styles.searchResultTitleDone]}
                numberOfLines={1}
              >
                {todo.title}
              </Text>
              <Text style={styles.searchResultDate}>
                {formatDisplayDate(todo.logicalDate)}
              </Text>
            </View>
            {todo.completed && <Text style={styles.searchResultCheck}>✓</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function TodayScreenContent() {
  const logicalDate = getLogicalDate();
  const allTodos = useTodoStore(s => s.todos);
  const addTodo = useTodoStore(s => s.addTodo);
  const toggleTodo = useTodoStore(s => s.toggleTodo);
  const deleteTodo = useTodoStore(s => s.deleteTodo);
  const updateTodo = useTodoStore(s => s.updateTodo);
  const reorderTodos = useTodoStore(s => s.reorderTodos);
  const carryOverTodos = useTodoStore(s => s.carryOverTodos);

  // Date navigation
  const [viewingDate, setViewingDate] = useState(logicalDate);
  const isToday = viewingDate === logicalDate;

  // Search
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  // All todos for the viewing date (sorted)
  const dateTodos = useMemo(() => {
    const dayTodos = allTodos.filter(t => t.logicalDate === viewingDate);
    return [...dayTodos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
      const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  }, [allTodos, viewingDate]);

  // Filtered by category
  const todos = useMemo(() => {
    if (activeCategory === 'all') return dateTodos;
    return dateTodos.filter(t => t.category === activeCategory);
  }, [dateTodos, activeCategory]);

  // Search results across all tasks
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTodos
      .filter(t => t.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 15);
  }, [allTodos, searchQuery]);

  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [quickActionTodo, setQuickActionTodo] = useState<Todo | null>(null);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [checkedCarryOver, setCheckedCarryOver] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCelebratedCount, setLastCelebratedCount] = useState(0);
  const syncFromFirestore = useTodoStore(s => s.syncFromFirestore);

  // Drag reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[]>([]);

  // Sync indicator
  const syncPulse = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const unsub = onSyncStateChange((syncing) => {
      setIsSyncing(syncing);
      if (syncing) {
        RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(syncPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            RNAnimated.timing(syncPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        ).start();
      } else {
        syncPulse.stopAnimation();
        syncPulse.setValue(1);
      }
    });
    return unsub;
  }, []);

  // Sync on mount
  useEffect(() => {
    syncFromFirestore().catch(() => {});
  }, []);

  // Progress bar animation
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const completed = dateTodos.filter(t => t.completed).length;
  const total = dateTodos.length;
  const progress = total > 0 ? completed / total : 0;

  useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Celebration: trigger when all tasks completed
  useEffect(() => {
    if (isToday && total > 0 && completed === total && completed > lastCelebratedCount) {
      setShowCelebration(true);
      setLastCelebratedCount(completed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [completed, total, isToday]);

  // Reset celebration tracking when date changes
  useEffect(() => {
    setLastCelebratedCount(0);
  }, [viewingDate]);

  // Total pomodoro minutes for viewed date
  const totalPomodoroMinutes = useMemo(
    () => dateTodos.reduce((s, t) => s + (t.pomodoroMinutesLogged || 0), 0),
    [dateTodos]
  );

  // Total estimated time remaining (incomplete tasks)
  const totalEstimatedMinutes = useMemo(
    () => dateTodos.filter(t => !t.completed).reduce((s, t) => s + (t.estimatedMinutes || 0), 0),
    [dateTodos]
  );

  // Check for carry-over tasks on mount
  useEffect(() => {
    if (checkedCarryOver) return;
    setCheckedCarryOver(true);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayTodos = allTodos.filter(t => t.logicalDate === logicalDate);
    const yesterdayIncomplete = allTodos.filter(
      t => t.logicalDate === yesterdayStr && !t.completed
    );
    const alreadyCarried = todayTodos.some(t => t.carriedOverFrom);
    if (yesterdayIncomplete.length > 0 && !alreadyCarried) {
      setShowCarryOver(true);
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo(id);
  }, [toggleTodo]);

  const handleAdd = useCallback((title: string, priority?: Priority, category?: Category) => {
    addTodo(title, priority ?? null, category ?? null, viewingDate);
  }, [addTodo, viewingDate]);

  const greeting = useMemo(() => getTimeBasedGreeting(), [logicalDate]);

  // Carry-over candidates count
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const carryOverCount = useMemo(
    () => allTodos.filter(t => t.logicalDate === yesterdayStr && !t.completed).length,
    [allTodos, yesterdayStr]
  );

  // Categories that exist in viewed date's tasks
  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    dateTodos.forEach(t => { if (t.category) cats.add(t.category); });
    return CATEGORIES.filter(c => cats.has(c.key!));
  }, [dateTodos]);

  // Date navigation handlers
  const goToPrevDay = useCallback(() => {
    setViewingDate(prev => shiftDate(prev, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToNextDay = useCallback(() => {
    setViewingDate(prev => shiftDate(prev, 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToToday = useCallback(() => {
    setViewingDate(logicalDate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [logicalDate]);

  // Search handlers
  const toggleSearch = useCallback(() => {
    setSearchExpanded(prev => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  const handleSearchSelect = useCallback((todo: Todo) => {
    setViewingDate(todo.logicalDate);
    setSearchExpanded(false);
    setSearchQuery('');
  }, []);

  // Drag to reorder handlers
  const handleDragStart = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const incompleteIds = dateTodos.filter(t => !t.completed).map(t => t.id);
    setDraggingId(id);
    setDragOrder(incompleteIds);
  }, [dateTodos]);

  const handleDragEnd = useCallback((fromId: string, toIndex: number) => {
    if (dragOrder.length === 0) return;
    const fromIndex = dragOrder.indexOf(fromId);
    if (fromIndex < 0 || fromIndex === toIndex) {
      setDraggingId(null);
      setDragOrder([]);
      return;
    }
    const newOrder = [...dragOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    reorderTodos(newOrder);
    setDraggingId(null);
    setDragOrder([]);
  }, [dragOrder, reorderTodos]);

  const renderItem = useCallback(({ item, index }: { item: Todo; index: number }) => (
    <TodoItem
      todo={item}
      onToggle={() => handleToggle(item.id)}
      onDelete={() => deleteTodo(item.id)}
      onPress={() => setPomodoroTodo(item)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setQuickActionTodo(item);
      }}
    />
  ), [handleToggle, deleteTodo]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={goToPrevDay} style={styles.navArrow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDisplayDate(viewingDate)}</Text>
          <TouchableOpacity onPress={goToNextDay} style={styles.navArrow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrowText}>›</Text>
          </TouchableOpacity>
          {isSyncing && (
            <RNAnimated.Text style={[styles.syncIcon, { opacity: syncPulse }]}>☁</RNAnimated.Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleSearch} style={styles.searchIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.searchIconText}>{searchExpanded ? '✕' : '⌕'}</Text>
          </TouchableOpacity>
          {totalPomodoroMinutes > 0 && (
            <Text style={styles.pomodoroTotal}>⏱ {totalPomodoroMinutes}m</Text>
          )}
          <Text style={styles.countText}>
            {completed}/{total} done
          </Text>
        </View>
      </View>

      {/* Search bar (collapsible) */}
      {searchExpanded && (
        <View style={styles.searchContainer}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search all tasks..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onSelect={handleSearchSelect}
            onClose={() => { setSearchExpanded(false); setSearchQuery(''); }}
          />
        </View>
      )}

      {/* Back to Today pill */}
      {!isToday && (
        <TouchableOpacity style={styles.backToTodayPill} onPress={goToToday}>
          <Text style={styles.backToTodayText}>Back to Today</Text>
        </TouchableOpacity>
      )}

      {/* Greeting (only on today) */}
      {isToday && (
        <>
          <Text style={styles.greetingPrefix}>{greeting.prefix}</Text>
          <Text style={styles.greeting}>{greeting.message}</Text>
        </>
      )}

      {/* Estimated time remaining */}
      {totalEstimatedMinutes > 0 && (
        <Text style={styles.estimatedTimeHeader}>{formatEstimatedTime(totalEstimatedMinutes)}</Text>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressBar}>
          <RNAnimated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      )}

      {/* Category filter chips */}
      {activeCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
            onPress={() => setActiveCategory('all')}
          >
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {activeCats.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.filterChip,
                activeCategory === c.key && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => setActiveCategory(activeCategory === c.key ? 'all' : c.key)}
            >
              <Text style={[
                styles.filterChipText,
                activeCategory === c.key && { color: Colors.dark.background },
              ]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <TodoInput onAdd={handleAdd} />

      {/* Todo list */}
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        windowSize={10}
        maxToRenderPerBatch={15}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              setCheckedCarryOver(false);
              await syncFromFirestore().catch(() => {});
              setRefreshing(false);
            }}
            tintColor={Colors.dark.textTertiary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>+</Text>
            <Text style={styles.emptyText}>
              {isToday ? 'Your day is a blank canvas' : 'No tasks for this day'}
            </Text>
            <Text style={styles.emptySubtext}>
              {isToday ? 'Add your first task above to get started' : 'Add a task or navigate to another day'}
            </Text>
          </View>
        }
      />

      {/* Carry-over modal */}
      {showCarryOver && (
        <Modal visible={showCarryOver} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Unfinished Business</Text>
              <Text style={styles.modalText}>
                You have {carryOverCount} unfinished task{carryOverCount !== 1 ? 's' : ''} from yesterday.
              </Text>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  carryOverTodos();
                  setShowCarryOver(false);
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Carry Over All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setShowCarryOver(false)}
              >
                <Text style={styles.modalSecondaryBtnText}>Start Fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Pomodoro modal */}
      {pomodoroTodo && (
        <PomodoroTimer
          todo={pomodoroTodo}
          visible={!!pomodoroTodo}
          onClose={() => setPomodoroTodo(null)}
        />
      )}

      {/* Quick actions */}
      {quickActionTodo && (
        <QuickActions
          todo={quickActionTodo}
          visible={!!quickActionTodo}
          onClose={() => setQuickActionTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => { deleteTodo(id); setQuickActionTodo(null); }}
        />
      )}

      {/* Celebration overlay */}
      <ConfettiCelebration
        visible={showCelebration}
        onDismiss={() => setShowCelebration(false)}
      />
    </SafeAreaView>
  );
}

export default function TodayScreen() {
  return (
    <ErrorBoundary>
      <TodayScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navArrow: {
    padding: 4,
  },
  navArrowText: {
    color: Colors.dark.textSecondary,
    fontSize: 28,
    fontFamily: Fonts.body,
    lineHeight: 32,
  },
  syncIcon: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
  },
  dateText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    flexShrink: 1,
  },
  countText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  pomodoroTotal: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 13,
  },

  // Search
  searchIconBtn: {
    padding: 4,
  },
  searchIconText: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
    fontFamily: Fonts.body,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchResults: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.xs,
    maxHeight: 240,
    overflow: 'hidden',
  },
  searchScroll: {
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  searchResultTitleDone: {
    color: Colors.dark.textTertiary,
    textDecorationLine: 'line-through',
  },
  searchResultDate: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  searchResultCheck: {
    color: Colors.dark.success,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  searchNoResults: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },

  // Back to today
  backToTodayPill: {
    alignSelf: 'center',
    backgroundColor: Colors.dark.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  backToTodayText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },

  greetingPrefix: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 15,
    paddingHorizontal: Spacing.lg,
    paddingTop: 2,
  },
  greeting: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // Estimated time
  estimatedTimeHeader: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },

  progressBar: {
    height: 3,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 2,
  },
  filterScroll: {
    maxHeight: 40,
    marginTop: Spacing.sm,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  filterChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.dark.background,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    color: Colors.dark.textTertiary,
    marginBottom: Spacing.md,
    fontFamily: Fonts.body,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
  },
  emptySubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Carry-over modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 20,
    marginBottom: Spacing.sm,
  },
  modalText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalPrimaryBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalPrimaryBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  modalSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },

  // Celebration
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiParticle: {
    position: 'absolute',
  },
  celebrationTextContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  celebrationText: {
    color: Colors.dark.success,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    textAlign: 'center',
  },
});
