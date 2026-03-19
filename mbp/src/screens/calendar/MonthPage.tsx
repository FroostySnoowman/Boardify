import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { EventType } from '../../api/calendar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type MonthPageProps = {
  currentDate: Date;
  events: EventType[];
  onPrevMonth(): void;
  onNextMonth(): void;
  onOpenDay(day: number): void;
  onEventClick(event: EventType): void;
};

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(' - ');
  const startStr = parts[0] || timeStr;
  
  const trimmed = startStr.trim().toUpperCase();
  const isPM = trimmed.includes('PM') && !trimmed.includes('12');
  const isAM = trimmed.includes('AM');
  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

export default function MonthPage({
  currentDate,
  events,
  onPrevMonth,
  onNextMonth,
  onOpenDay,
  onEventClick
}: MonthPageProps) {
  const insets = useSafeAreaInsets();
  const [calendarHeight, setCalendarHeight] = React.useState(0);
  const calendarGridRef = React.useRef<View>(null);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weeksToShow = 6;
  
  const cellHeight = calendarHeight > 0 ? calendarHeight / weeksToShow : Math.max(80, (SCREEN_HEIGHT - 200) / weeksToShow);

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays: number[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push(prevMonthLastDay - i);
  }

  const nextMonthDays = 42 - (firstDayIndex + daysInMonth);
  const nextMonthFirstDays: number[] = [];
  for (let i = 1; i <= nextMonthDays; i++) {
    nextMonthFirstDays.push(i);
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventType[]>();
    
    events.forEach(event => {
      const [ey, em, ed] = event.date.split('-').map(Number);
      if (ey === year && (em - 1) === month) {
        const day = ed;
        if (!map.has(day)) {
          map.set(day, []);
        }
        map.get(day)!.push(event);
      }
    });
    
    map.forEach((dayEvents, day) => {
      dayEvents.sort((a, b) => {
        const timeA = parseTime(a.time);
        const timeB = parseTime(b.time);
        return timeA - timeB;
      });
    });
    
    return map;
  }, [events, year, month]);

  const getEventColor = (event: EventType): string => {
    if (event.color) {
      const match = event.color.match(/bg-(\w+)-(\d+)/);
      if (match) {
        const colorMap: Record<string, string> = {
          red: '#ef4444',
          blue: '#3b82f6',
          green: '#22c55e',
          purple: '#a855f7',
          yellow: '#eab308',
          gray: '#6b7280',
        };
        return colorMap[match[1]] || '#3b82f6';
      }
    }
    const typeColors: Record<string, string> = {
      match: '#ef4444',
      practice: '#3b82f6',
      tournament: '#a855f7',
      other: '#6b7280',
    };
    return typeColors[event.type] || '#3b82f6';
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthSelectorRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    if (monthSelectorRef.current) {
      const scrollPosition = month * 60;
      monthSelectorRef.current.scrollTo({ x: Math.max(0, scrollPosition - 100), animated: true });
    }
  }, [month]);

  const MAX_VISIBLE_EVENTS = 4;

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <ScrollView
        ref={monthSelectorRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthSelectorContainer}
        style={styles.monthSelector}
      >
        {monthNames.map((monthName, index) => {
          const isSelected = index === month;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.monthPill, isSelected && styles.monthPillSelected]}
              onPress={() => {
                if (index !== month) {
                  const newDate = new Date(year, index, 1);
                  if (index < month) {
                    onPrevMonth();
                  } else {
                    onNextMonth();
                  }
                }
              }}
            >
              <Text style={[styles.monthPillText, isSelected && styles.monthPillTextSelected]}>
                {monthName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.weekdayHeaders}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <View key={index} style={styles.weekdayHeader}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      <View 
        ref={calendarGridRef}
        style={styles.calendarGrid}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 0) {
            const bottomTabBarHeight = 60 + insets.bottom;
            const availableHeight = Math.max(0, height - bottomTabBarHeight);
            setCalendarHeight(availableHeight > 0 ? availableHeight : height);
          }
        }}
      >
        {prevMonthDays.map((day, index) => {
          const date = new Date(year, month - 1, day);
          const dateStr = formatDate(date);
          const dayEvents = events.filter(e => e.date === dateStr);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS;

          return (
            <TouchableOpacity
              key={`prev-${day}`}
              style={[styles.dayCell, styles.otherMonthCell, { height: cellHeight }]}
              onPress={() => onOpenDay(day)}
              activeOpacity={0.7}
            >
              <Text style={styles.otherMonthDayNumber}>{day}</Text>
              <View style={styles.eventsContainer}>
                {visibleEvents.map((event, idx) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventChip, { backgroundColor: getEventColor(event) }]}
                    onPress={e => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.eventChipText} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </TouchableOpacity>
                ))}
                {hasMore && (
                  <Text style={styles.moreIndicator}>...</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          const dayEvents = eventsByDay.get(day) || [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS;

          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayCell, { height: cellHeight }]}
              onPress={() => onOpenDay(day)}
              activeOpacity={0.7}
            >
              <View style={styles.dayNumberContainer}>
                {isToday && <View style={styles.todayCircle} />}
                <Text style={[styles.dayNumber, isToday && styles.todayDayNumber]}>
                  {day}
                </Text>
              </View>
              <View style={styles.eventsContainer}>
                {visibleEvents.map((event, idx) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventChip, { backgroundColor: getEventColor(event) }]}
                    onPress={e => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.eventChipText} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </TouchableOpacity>
                ))}
                {hasMore && (
                  <Text style={styles.moreIndicator}>...</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {nextMonthFirstDays.map((day, index) => {
          const date = new Date(year, month + 1, day);
          const dateStr = formatDate(date);
          const dayEvents = events.filter(e => e.date === dateStr);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS;

          return (
            <TouchableOpacity
              key={`next-${day}`}
              style={[styles.dayCell, styles.otherMonthCell, { height: cellHeight }]}
              onPress={() => onOpenDay(day)}
              activeOpacity={0.7}
            >
              <Text style={styles.otherMonthDayNumber}>{day}</Text>
              <View style={styles.eventsContainer}>
                {visibleEvents.map((event, idx) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventChip, { backgroundColor: getEventColor(event) }]}
                    onPress={e => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.eventChipText} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </TouchableOpacity>
                ))}
                {hasMore && (
                  <Text style={styles.moreIndicator}>...</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  monthSelector: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  monthSelectorContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 60,
    alignItems: 'center',
  },
  monthPillSelected: {
    backgroundColor: '#3b82f6',
  },
  monthPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  monthPillTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  weekdayHeaders: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  weekdayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  dayCell: {
    width: '14.28%',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 4,
    backgroundColor: '#020617',
  },
  otherMonthCell: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  dayNumberContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  todayCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    zIndex: 1,
  },
  todayDayNumber: {
    color: '#ffffff',
    fontWeight: '600',
  },
  otherMonthDayNumber: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
    marginBottom: 2,
  },
  eventsContainer: {
    flex: 1,
    gap: 2,
    overflow: 'hidden',
  },
  eventChip: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 1,
    minHeight: 18,
    justifyContent: 'center',
  },
  eventChipText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
  moreIndicator: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
  },
});
