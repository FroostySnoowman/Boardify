import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { EventType } from '../../api/calendar';
import { formatMinutesForDisplay, formatHourLabel } from '../../utils/dateUtils';

type DayPageProps = {
  currentDate: Date;
  selectedDate: Date | null;
  eventsForDay: EventType[];
  onPrevDay(): void;
  onNextDay(): void;
  onEventClick(event: EventType): void;
  onAddEvent(date: Date): void;
};

function parseTime(timeStr: string): { start: number; end: number } | null {
  const parts = timeStr.split(' - ');
  const startStr = parts[0] || timeStr;
  
  const parseTimeStr = (str: string): number => {
    const trimmed = str.trim().toUpperCase();
    const isPM = trimmed.includes('PM') && !trimmed.includes('12');
    const isAM = trimmed.includes('AM');
    const match = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };
  
  const start = parseTimeStr(startStr);
  const end = parts[1] ? parseTimeStr(parts[1]) : start + 60;
  
  return { start, end };
}

const formatMinutes = formatMinutesForDisplay;

export default function DayPage({
  currentDate,
  selectedDate,
  eventsForDay,
  onPrevDay,
  onNextDay,
  onEventClick,
  onAddEvent
}: DayPageProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const displayDate = selectedDate ?? currentDate;
  const now = new Date();
  const isToday = displayDate.toDateString() === now.toDateString();
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  useEffect(() => {
    const scrollTo6am = () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 360, animated: false });
      }
    };
    
    setTimeout(scrollTo6am, 100);
  }, [displayDate]);
  
  const currentTimeMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : null;
  
  const processedEvents = useMemo(() => {
    return eventsForDay
      .map(event => {
        const timeData = parseTime(event.time);
        if (!timeData) return null;
        
        return {
          ...event,
          startMinutes: timeData.start,
          endMinutes: timeData.end,
          duration: timeData.end - timeData.start,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [eventsForDay]);
  
  const allDayEvents = useMemo(() => {
    return eventsForDay.filter(e => {
      const timeData = parseTime(e.time);
      return !timeData || timeData.end - timeData.start >= 24 * 60;
    });
  }, [eventsForDay]);
  
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
  
  const getEventStyle = (event: typeof processedEvents[0]) => {
    const hourHeight = 60;
    const startHour = 0;
    
    const top = ((event.startMinutes - startHour * 60) / 60) * hourHeight;
    const height = (event.duration / 60) * hourHeight;
    
    return {
      position: 'absolute' as const,
      top: Math.max(0, top),
      left: 0,
      right: 0,
      height: Math.max(20, height),
      backgroundColor: getEventColor(event),
      borderRadius: 4,
      padding: 6,
      paddingLeft: 8,
      minHeight: 20,
    };
  };
  
  const dayOfWeek = displayDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNumber = displayDate.getDate();
  const monthYear = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onPrevDay} style={styles.navButton}>
            <Feather name="chevron-left" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNextDay} style={styles.navButton}>
            <Feather name="chevron-right" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.dateContainer}>
          <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
          <View style={[styles.dateCircle, isToday && styles.todayCircle]}>
            <Text style={[styles.dateNumber, isToday && styles.todayDateNumber]}>{dayNumber}</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={() => onAddEvent(displayDate)} style={styles.addButton}>
          <Feather name="plus" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
      
      {allDayEvents.length > 0 && (
        <View style={styles.allDayContainer}>
          {allDayEvents.map(event => (
            <TouchableOpacity
              key={event.id}
              onPress={() => onEventClick(event)}
              style={[styles.allDayEvent, { backgroundColor: getEventColor(event) }]}
            >
              <Text style={styles.allDayText} numberOfLines={1}>{event.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.timeGrid}>
          <View style={styles.timeLabels}>
            {hours.map(hour => (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.timeLabel} numberOfLines={1}>
                  {formatHourLabel(hour)}
                </Text>
                <View style={styles.hourLine} />
              </View>
            ))}
          </View>
          
          <View style={styles.eventsArea}>
            {hours.map(hour => (
              <View key={hour} style={[styles.gridLine, { top: hour * 60 }]} />
            ))}
            
            {isToday && currentTimeMinutes !== null && currentTimeMinutes >= 0 && currentTimeMinutes <= 23 * 60 + 59 && (
              <View style={[styles.currentTimeLine, { top: (currentTimeMinutes / 60) * 60 }]}>
                <View style={styles.currentTimeDot} />
                <View style={styles.currentTimeLineBar} />
              </View>
            )}
            
            {processedEvents.map(event => {
              const style = getEventStyle(event);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={style}
                  onPress={() => onEventClick(event)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventTime} numberOfLines={1}>
                    {formatMinutes(event.startMinutes)} - {formatMinutes(event.endMinutes)}
                  </Text>
                  {event.location && (
                    <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateContainer: {
    alignItems: 'center',
    gap: 4,
  },
  dayOfWeek: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  dateCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: '#3b82f6',
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  todayDateNumber: {
    color: '#ffffff',
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  allDayContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  allDayEvent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  allDayText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  timeGrid: {
    flexDirection: 'row',
    minHeight: 24 * 60,
  },
  timeLabels: {
    width: 68,
    paddingRight: 8,
  },
  hourRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  timeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    width: 58,
    textAlign: 'right',
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 3,
  },
  eventsArea: {
    flex: 1,
    position: 'relative',
    paddingLeft: 8,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginLeft: -6,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#ef4444',
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventTime: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
  },
  eventLocation: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
});
