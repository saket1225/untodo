import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Modal, TouchableOpacity, ScrollView,
  Animated as RNAnimated, RefreshControl, TextInput, Dimensions, PanResponder,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, shiftDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import QuickActions from '../../engines/todo/components/QuickActions';
import TaskDetail from '../../engines/todo/components/TaskDetail';
import FocusMode from '../../engines/todo/components/FocusMode';
import MorningBrief from '../../engines/todo/components/MorningBrief';
import MilestoneCelebration from '../../engines/milestones/MilestoneCelebration';
import { useMilestoneStore } from '../../engines/milestones/store';
import ErrorBoundary from '../../components/ErrorBoundary';
import UndoToast, { showUndoToast } from '../../components/UndoToast';
import { Todo, Category, CATEGORIES, Priority, Recurrence } from '../../engines/todo/types';
import { onSyncStateChange } from '../../lib/firebase-sync';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';

import {
  ConfettiCelebration,
  SkeletonLoader,
  EmptyState,
  StreakBanner,
  useTaskStreak,
  DailyScore,
  StreakMilestone,
  DailyQuote,
  GestureTutorial,
  GESTURE_TUTORIAL_KEY,
  CalendarPicker,
  getTimeOfDay,
  getGreeting,
  getGreetingSub,
  TaskInsight,
  ShareDayCard,
  formatDayHeader,
  PomodoroHeaderIndicator,
} from '../../components/today';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Items have variable heights (subtasks, habit dots, metadata) - no getItemLayout

function TodayScreenContent() {
  const logicalDate = getLogicalDate();
  const allTodos = useTodoStore(s => s.todos);
  const addTodo = useTodoStore(s => s.addTodo);
  const toggleTodo = useTodoStore(s => s.toggleTodo);
  const deleteTodo = useTodoStore(s => s.deleteTodo);
  const restoreTodo = useTodoStore(s => s.restoreTodo);
  const updateTodo = useTodoStore(s => s.updateTodo);
  const reorderTodos = useTodoStore(s => s.reorderTodos);
  const carryOverTodos = useTodoStore(s => s.carryOverTodos);
  const autoCarryOldTodos = useTodoStore(s => s.autoCarryOldTodos);

  // Milestone check
  const checkMilestones = useMilestoneStore(s => s.checkMilestones);

  // Streak
  const { streak, atRisk } = useTaskStreak(allTodos);

  // Date navigation
  const [viewingDate, setViewingDate] = useState(logicalDate);
  const isToday = viewingDate === logicalDate;
  const [showCalendar, setShowCalendar] = useState(false);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Collapsible completed section
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  // All todos for the viewing date (sorted with smart ordering)
  const dateTodos = useMemo(() => {
    const dayTodos = allTodos.filter(t => t.logicalDate === viewingDate);
    return [...dayTodos].sort((a, b) => {
      // Completed tasks always at bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Carried-over / overdue tasks at top
      const aCarried = a.carriedOverFrom ? 1 : 0;
      const bCarried = b.carriedOverFrom ? 1 : 0;
      if (aCarried !== bCarried) return bCarried - aCarried;
      // Then by priority
      const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
      const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  }, [allTodos, viewingDate]);

  // Split into active and completed
  const activeTodos = useMemo(() => dateTodos.filter(t => !t.completed), [dateTodos]);
  const completedTodos = useMemo(() => dateTodos.filter(t => t.completed), [dateTodos]);

  // Filtered by category — only active tasks in main list, completed shown in footer
  const todos = useMemo(() => {
    return activeCategory === 'all' ? activeTodos : activeTodos.filter(t => t.category === activeCategory);
  }, [activeTodos, activeCategory]);

  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [quickActionTodo, setQuickActionTodo] = useState<Todo | null>(null);
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [focusTodo, setFocusTodo] = useState<Todo | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(0);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [carryOverMode, setCarryOverMode] = useState<'prompt' | 'review'>('prompt');
  const [carryOverSelected, setCarryOverSelected] = useState<Set<string>>(new Set());
  const [checkedCarryOver, setCheckedCarryOver] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCelebratedCount, setLastCelebratedCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showGestureTutorial, setShowGestureTutorial] = useState(false);
  const syncFromFirestore = useTodoStore(s => s.syncFromFirestore);
  const spawnRecurringTasks = useTodoStore(s => s.spawnRecurringTasks);

  // Entrance fade animation
  const entranceFade = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(entranceFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Swipe gesture for day navigation
  const swipeAnim = useRef(new RNAnimated.Value(0)).current;
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 30 && Math.abs(gs.dy) < 30,
      onPanResponderMove: (_, gs) => {
        swipeAnim.setValue(gs.dx * 0.3);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80) {
          // Swipe left -> next day
          RNAnimated.timing(swipeAnim, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setViewingDate(prev => shiftDate(prev, 1));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            swipeAnim.setValue(SCREEN_WIDTH);
            RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          });
        } else if (gs.dx > 80) {
          // Swipe right -> prev day
          RNAnimated.timing(swipeAnim, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setViewingDate(prev => shiftDate(prev, -1));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            swipeAnim.setValue(-SCREEN_WIDTH);
            RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          });
        } else {
          RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // Keyboard shortcut state (for web)
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRefForFocus = useRef<any>(null);

  useKeyboardShortcuts({
    onNewTask: () => {
      // No auto-focus - user taps input to open keyboard
    },
    onNavigateUp: () => {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    },
    onNavigateDown: () => {
      setSelectedIndex(prev => Math.min(todos.length - 1, prev + 1));
    },
    onToggleSelected: () => {
      if (selectedIndex >= 0 && selectedIndex < todos.length) {
        handleToggle(todos[selectedIndex].id);
      }
    },
    onDeleteSelected: () => {
      if (selectedIndex >= 0 && selectedIndex < todos.length) {
        handleDelete(todos[selectedIndex]);
        setSelectedIndex(prev => Math.min(prev, todos.length - 2));
      }
    },
  }, true);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Sync on mount and spawn recurring tasks
  useEffect(() => {
    syncFromFirestore().catch(() => {}).finally(() => setInitialLoading(false));
    spawnRecurringTasks();
  }, []);

  // Streak milestone check
  const MILESTONE_KEY = 'untodo-last-milestone';
  useEffect(() => {
    if (streak <= 0 || !isToday) return;
    const milestones = [3, 7, 14, 30, 60, 100];
    if (!milestones.includes(streak)) return;
    let mounted = true;
    AsyncStorage.getItem(MILESTONE_KEY).then(val => {
      if (!mounted) return;
      const last = parseInt(val || '0', 10);
      if (streak > last) {
        setMilestoneStreak(streak);
        setShowMilestone(true);
        AsyncStorage.setItem(MILESTONE_KEY, streak.toString());
      }
    });
    return () => { mounted = false; };
  }, [streak, isToday]);

  // Compute habit history for recurring tasks (last 7 days completion)
  const habitHistories = useMemo(() => {
    const map: Record<string, boolean[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dateTodos.filter(t => t.recurrence).forEach(todo => {
      const history: boolean[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // Check if a task with the same title (or recurringParentId match) was completed on that day
        const parentId = todo.recurringParentId || todo.id;
        const found = allTodos.some(t =>
          t.logicalDate === dateStr &&
          t.completed &&
          (t.recurringParentId === parentId || t.id === parentId || (t.title === todo.title && t.recurrence))
        );
        history.push(found);
      }
      map[todo.id] = history;
    });
    return map;
  }, [dateTodos, allTodos]);

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

  // Check task milestones when tasks are completed
  useEffect(() => {
    if (completed > 0) checkMilestones();
  }, [completed]);

  // Reset celebration tracking when date changes
  useEffect(() => {
    setLastCelebratedCount(0);
  }, [viewingDate]);

  // Check for carry-over tasks on mount
  useEffect(() => {
    if (checkedCarryOver) return;
    setCheckedCarryOver(true);

    // Auto-carry tasks from 2+ days ago without asking
    autoCarryOldTodos();

    // Show modal only for yesterday's incomplete tasks
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
      setCarryOverMode('prompt');
      setCarryOverSelected(new Set(yesterdayIncomplete.map(t => t.id)));
    }
  }, []);

  // Gesture tutorial on first use
  useEffect(() => {
    AsyncStorage.getItem(GESTURE_TUTORIAL_KEY).then(val => {
      if (!val) {
        setShowGestureTutorial(true);
      }
    });
  }, []);

  const dismissGestureTutorial = useCallback(() => {
    setShowGestureTutorial(false);
    AsyncStorage.setItem(GESTURE_TUTORIAL_KEY, 'true');
  }, []);

  const handleToggle = useCallback((id: string) => {
    const todo = allTodos.find(t => t.id === id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo(id);
    // Show undo toast only when completing (not uncompleting)
    if (todo && !todo.completed) {
      showUndoToast({
        id,
        message: 'Task completed.',
        onUndo: () => toggleTodo(id),
      });
    }
  }, [toggleTodo, allTodos]);

  const handleAdd = useCallback((title: string, priority?: Priority, category?: Category, recurrence?: Recurrence, date?: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addTodo(title, priority ?? null, category ?? null, date || viewingDate, recurrence);
  }, [addTodo, viewingDate]);

  // Carry-over candidates count
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const yesterdayIncomplete = useMemo(
    () => allTodos.filter(t => t.logicalDate === yesterdayStr && !t.completed),
    [allTodos, yesterdayStr]
  );
  const carryOverCount = yesterdayIncomplete.length;

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

  // Multi-select handlers
  const enterSelectionMode = useCallback((firstId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([firstId]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) {
          setSelectionMode(false);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set(activeTodos.map(t => t.id)));
  }, [activeTodos]);

  const batchComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    selectedIds.forEach(id => toggleTodo(id));
    cancelSelection();
  }, [selectedIds, toggleTodo, cancelSelection]);

  const batchDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const deletedTodos = allTodos.filter(t => selectedIds.has(t.id));
    selectedIds.forEach(id => deleteTodo(id));
    cancelSelection();
    showUndoToast({
      id: 'batch-delete',
      message: `${deletedTodos.length} tasks deleted.`,
      onUndo: () => {
        deletedTodos.forEach(t => restoreTodo(t));
      },
    });
  }, [selectedIds, deleteTodo, restoreTodo, allTodos, cancelSelection]);

  const batchSetPriority = useCallback((priority: Priority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectedIds.forEach(id => updateTodo(id, { priority }));
    cancelSelection();
  }, [selectedIds, updateTodo, cancelSelection]);

  const handleDelete = useCallback((todo: Todo) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    deleteTodo(todo.id);
    showUndoToast({
      id: todo.id,
      message: 'Task deleted.',
      onUndo: () => restoreTodo(todo),
    });
  }, [deleteTodo, restoreTodo]);

  const renderItem = useCallback(({ item, index }: { item: Todo; index: number }) => (
    <TodoItem
      todo={item}
      onToggle={() => handleToggle(item.id)}
      onDelete={() => handleDelete(item)}
      onPress={() => setDetailTodo(item)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setQuickActionTodo(item);
      }}
      onFocus={!item.completed ? () => setFocusTodo(item) : undefined}
      selectionMode={selectionMode}
      isSelected={selectedIds.has(item.id)}
      onSelect={() => toggleSelection(item.id)}
      habitHistory={habitHistories[item.id]}
    />
  ), [handleToggle, handleDelete, selectionMode, selectedIds, enterSelectionMode, toggleSelection, habitHistories]);


  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <RNAnimated.View style={[styles.header, { opacity: entranceFade }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {isToday && (
              <View>
                <Text style={styles.greetingText}>{getGreeting()}</Text>
                {(() => {
                  const sub = getGreetingSub(completed, total);
                  return sub ? <Text style={styles.greetingSubText}>{sub}</Text> : null;
                })()}
              </View>
            )}
            <View style={styles.dateRow}>
              <TouchableOpacity
                onPress={goToPrevDay}
                style={styles.navArrow}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Previous day"
                accessibilityRole="button"
              >
                <Text style={styles.navArrowText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCalendar(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText} accessibilityRole="header">{formatDayHeader(viewingDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goToNextDay}
                style={styles.navArrow}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Next day"
                accessibilityRole="button"
              >
                <Text style={styles.navArrowText}>›</Text>
              </TouchableOpacity>
              {isSyncing && (
                <RNAnimated.Text style={[styles.syncIcon, { opacity: syncPulse }]} accessibilityLabel="Syncing">☁</RNAnimated.Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            {activeCats.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowFilters(prev => !prev);
                }}
                style={styles.searchIconBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
                accessibilityRole="button"
              >
                <Text style={[styles.searchIconText, showFilters && { color: Colors.dark.text }]}>☰</Text>
              </TouchableOpacity>
            )}
            {total > 0 && (
              <Text style={styles.progressText} accessibilityLabel={`${completed} of ${total} tasks done`}>
                {completed}/{total}{total > 0 && completed === total ? ' ✓' : ''}
              </Text>
            )}
          </View>
        </View>
      </RNAnimated.View>

      {/* Back to Today pill */}
      {!isToday && (
        <TouchableOpacity
          style={styles.backToTodayPill}
          onPress={goToToday}
          accessibilityLabel="Go back to today"
          accessibilityRole="button"
        >
          <Text style={styles.backToTodayText}>Back to Today</Text>
        </TouchableOpacity>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressBar}>
          <RNAnimated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      )}

      {/* Category filter chips - only visible when showFilters is true */}
      {showFilters && activeCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          accessibilityRole="tablist"
        >
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveCategory('all');
            }}
            accessibilityLabel="All categories"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeCategory === 'all' }}
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
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(activeCategory === c.key ? 'all' : c.key);
              }}
              accessibilityLabel={`Filter: ${c.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeCategory === c.key }}
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

      {/* Daily score */}
      {isToday && total > 0 && (
        <DailyScore completed={completed} total={total} streak={streak} />
      )}

      {/* Streak banner */}
      {isToday && (streak > 0 || atRisk) && (
        <StreakBanner streak={streak} atRisk={atRisk} />
      )}

      {/* Pomodoro header indicator */}
      <PomodoroHeaderIndicator />

      {/* Evening/night encouragement */}
      {isToday && (getTimeOfDay() === 'evening' || getTimeOfDay() === 'night') && activeTodos.length > 0 && activeTodos.length <= 3 && (
        <View style={styles.encourageBanner}>
          <Text style={styles.encourageText}>
            {getTimeOfDay() === 'night'
              ? `${activeTodos.length} left. Finish or let it go — sleep matters.`
              : `Almost there — just ${activeTodos.length} left. Quick finish?`}
          </Text>
        </View>
      )}

      {/* Selection mode bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionBarLeft}>
            <TouchableOpacity onPress={cancelSelection} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.selectionCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          </View>
          <View style={styles.selectionBarRight}>
            <TouchableOpacity onPress={selectAll} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={styles.selectionActionText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={batchComplete} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.success }]}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => batchSetPriority('high')} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.priorityHigh }]}>!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={batchDelete} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.error }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input */}
      {!selectionMode && (
        <TodoInput onAdd={handleAdd} viewingDate={viewingDate} />
      )}

      {/* Skeleton loading */}
      {initialLoading && total === 0 && (
        <SkeletonLoader />
      )}

      {/* All done banner */}
      {isToday && total > 0 && completed === total && !showCelebration && (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneCheck}>✓</Text>
          <View style={styles.allDoneContent}>
            <Text style={styles.allDoneText}>
              {getTimeOfDay() === 'night' ? 'All clear. Rest well.' :
               getTimeOfDay() === 'evening' ? 'Done for the day. Nice work.' :
               "Everything done! You're a machine 🔥"}
            </Text>
            {streak > 0 && (
              <Text style={styles.allDoneStreak}>{streak} day streak</Text>
            )}
          </View>
        </View>
      )}

      {/* Todo list with swipe gesture */}
      <RNAnimated.View
        style={{ flex: 1, transform: [{ translateX: swipeAnim }] }}
        {...swipePanResponder.panHandlers}
      >
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={renderItem}

        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Re-check carry-over, spawn recurring, and sync
              setCheckedCarryOver(false);
              spawnRecurringTasks();
              await syncFromFirestore().catch(() => {});
              setRefreshing(false);
            }}
            tintColor={Colors.dark.textTertiary}
            title="Pull to sync"
            titleColor={Colors.dark.textTertiary}
          />
        }
        ListEmptyComponent={
          !initialLoading ? (
            <EmptyState isToday={isToday} allCompleted={false} />
          ) : null
        }
        ListFooterComponent={
          <View>
            {completedTodos.length > 0 && (
              <View>
                <TouchableOpacity
                  style={styles.completedSectionHeader}
                  onPress={() => {
                    Haptics.selectionAsync();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setCompletedCollapsed(prev => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.completedSectionText}>
                    Completed ({completedTodos.length})
                  </Text>
                  <Text style={styles.completedSectionChevron}>
                    {completedCollapsed ? '›' : '⌄'}
                  </Text>
                </TouchableOpacity>
                {!completedCollapsed && completedTodos.map(item => (
                  <TodoItem
                    key={item.id}
                    todo={item}
                    onToggle={() => handleToggle(item.id)}
                    onDelete={() => handleDelete(item)}
                    onPress={() => setDetailTodo(item)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setQuickActionTodo(item);
                    }}
                  />
                ))}
              </View>
            )}
            {isToday && <TaskInsight todos={allTodos} />}
            {isToday && total > 0 && <DailyQuote />}
            {isToday && total > 0 && completed > 0 && (
              <ShareDayCard completed={completed} total={total} streak={streak} />
            )}
          </View>
        }
      />
      </RNAnimated.View>

      {/* Carry-over modal */}
      {showCarryOver && (
        <Modal visible={showCarryOver} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Unfinished Business</Text>
              {carryOverMode === 'prompt' ? (
                <>
                  <Text style={styles.modalText}>
                    You have {carryOverCount} unfinished task{carryOverCount !== 1 ? 's' : ''} from yesterday.
                  </Text>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      carryOverTodos();
                      setShowCarryOver(false);
                    }}
                    accessibilityLabel="Carry over all unfinished tasks"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalPrimaryBtnText}>Carry All Forward</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalOutlineBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCarryOverMode('review');
                    }}
                    accessibilityLabel="Review tasks to carry over"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalOutlineBtnText}>Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => setShowCarryOver(false)}
                    accessibilityLabel="Start fresh without carrying over"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalSecondaryBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalText}>Select tasks to carry forward:</Text>
                  <ScrollView style={styles.reviewList}>
                    {yesterdayIncomplete.map(task => {
                      const selected = carryOverSelected.has(task.id);
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.reviewItem}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setCarryOverSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(task.id)) next.delete(task.id);
                              else next.add(task.id);
                              return next;
                            });
                          }}
                        >
                          <View style={[styles.reviewCheck, selected && styles.reviewCheckSelected]}>
                            {selected && <Text style={styles.reviewCheckMark}>✓</Text>}
                          </View>
                          <Text style={styles.reviewItemText} numberOfLines={2}>{task.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.modalPrimaryBtn, carryOverSelected.size === 0 && { opacity: 0.4 }]}
                    disabled={carryOverSelected.size === 0}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      // Carry only selected tasks
                      const now = new Date().toISOString();
                      const selectedTasks = yesterdayIncomplete.filter(t => carryOverSelected.has(t.id));
                      selectedTasks.forEach(t => {
                        addTodo(t.title, t.priority, t.category, logicalDate, t.recurrence);
                      });
                      setShowCarryOver(false);
                    }}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      Carry {carryOverSelected.size} Task{carryOverSelected.size !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => setCarryOverMode('prompt')}
                  >
                    <Text style={styles.modalSecondaryBtnText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
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

      {/* Task detail */}
      {detailTodo && (
        <TaskDetail
          todo={detailTodo}
          visible={!!detailTodo}
          onClose={() => setDetailTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => { deleteTodo(id); setDetailTodo(null); }}
          onStartPomodoro={(todo) => { setDetailTodo(null); setPomodoroTodo(todo); }}
        />
      )}

      {/* Quick actions */}
      {quickActionTodo && (
        <QuickActions
          todo={quickActionTodo}
          visible={!!quickActionTodo}
          onClose={() => setQuickActionTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => {
            const todo = allTodos.find(t => t.id === id);
            deleteTodo(id);
            setQuickActionTodo(null);
            if (todo) {
              showUndoToast({
                id,
                message: 'Task deleted.',
                onUndo: () => restoreTodo(todo),
              });
            }
          }}
        />
      )}

      {/* Celebration overlay */}
      <ConfettiCelebration
        visible={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        streak={streak}
      />

      {/* Calendar picker */}
      {showCalendar && (
        <CalendarPicker
          selectedDate={viewingDate}
          allTodos={allTodos}
          onSelectDate={setViewingDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Focus mode */}
      {focusTodo && (
        <FocusMode
          todo={focusTodo}
          visible={!!focusTodo}
          onClose={() => setFocusTodo(null)}
          onComplete={() => {
            toggleTodo(focusTodo.id);
            setFocusTodo(null);
          }}
        />
      )}

      {/* Streak milestone celebration */}
      <StreakMilestone
        streak={milestoneStreak}
        visible={showMilestone}
        onDismiss={() => setShowMilestone(false)}
      />

      {/* Morning brief overlay */}
      <MorningBrief onDismiss={() => {}} />

      {/* Task milestone celebration */}
      <MilestoneCelebration />

      {/* Gesture tutorial */}
      {showGestureTutorial && (
        <GestureTutorial onDismiss={dismissGestureTutorial} />
      )}

      {/* Undo toast */}
      <UndoToast />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  greetingSubText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  navArrow: {
    padding: 4,
  },
  navArrowText: {
    color: Colors.dark.textTertiary,
    fontSize: 30,
    fontFamily: Fonts.body,
    lineHeight: 34,
  },
  syncIcon: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
  },
  dateText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 28,
    flexShrink: 1,
    letterSpacing: -0.5,
  },
  completedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  completedSectionText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  completedSectionChevron: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
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

  progressBar: {
    height: 3,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
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
  // Selection mode
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  selectionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  selectionCancel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  selectionCount: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  selectionActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionActionText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  list: {
    paddingBottom: 120,
    paddingTop: Spacing.xs,
  },
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.success + '12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.success + '20',
    marginTop: Spacing.sm,
  },
  allDoneCheck: {
    color: Colors.dark.success,
    fontSize: 18,
    fontWeight: '700',
  },
  allDoneText: {
    color: Colors.dark.success,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modalPrimaryBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  modalSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  modalOutlineBtn: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalOutlineBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  reviewList: {
    maxHeight: 240,
    width: '100%',
    marginBottom: Spacing.md,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    gap: Spacing.md,
  },
  reviewCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCheckSelected: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  reviewCheckMark: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewItemText: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    flex: 1,
  },

  encourageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.timer + '12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.timer + '20',
    marginTop: Spacing.sm,
  },
  encourageText: {
    color: Colors.dark.timer,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    textAlign: 'center',
  },
  allDoneContent: {
    flex: 1,
  },
  allDoneStreak: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    marginTop: 2,
  },
});
