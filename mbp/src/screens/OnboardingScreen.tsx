import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { markOnboardingComplete } from '../api/user';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function IndicatorDot({
  index,
  currentPage,
  translateX,
  screenWidth,
}: {
  index: number;
  currentPage: number;
  translateX: ReturnType<typeof useSharedValue<number>>;
  screenWidth: number;
}) {
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * screenWidth,
      index * screenWidth,
      (index + 1) * screenWidth,
    ];
    const width = interpolate(
      translateX.value,
      inputRange,
      [8, index === currentPage ? 32 : 8, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      translateX.value,
      inputRange,
      [0.3, index === currentPage ? 1 : 0.5, 0.3],
      Extrapolation.CLAMP
    );
    return {
      width,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.indicator,
        index === currentPage && styles.indicatorActive,
        indicatorAnimatedStyle,
      ]}
    />
  );
}

type FeatherIconName = keyof typeof Feather.glyphMap;

interface FeatureDetail {
  icon: FeatherIconName;
  title: string;
  description: string;
}

interface OnboardingPage {
  title: string;
  subtitle: string;
  description: string;
  icon: FeatherIconName;
  gradient: readonly [string, string, ...string[]];
  features: FeatureDetail[];
}

const PAGES: OnboardingPage[] = [
  {
    title: 'Welcome to MyBreakPoint',
    subtitle: 'Your Ultimate Companion',
    description: 'The all-in-one platform for tennis and pickleball players, coaches, and teams. Track matches, analyze performance, and stay connected like never before.',
    icon: 'award',
    gradient: ['rgba(34, 197, 94, 0.4)', 'rgba(16, 185, 129, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'target',
        title: 'Precision Tracking',
        description: 'Every point, every match, every statistic captured with professional-grade accuracy',
      },
      {
        icon: 'trending-up',
        title: 'Performance Insights',
        description: 'Deep analytics that help you understand your game and improve faster',
      },
      {
        icon: 'users',
        title: 'Team Collaboration',
        description: 'Seamlessly connect with teammates, coaches, and opponents',
      },
    ],
  },
  {
    title: 'Match Center',
    subtitle: 'Professional Match Tracking',
    description: 'Log matches with incredible detail. Track every point, analyze every rally, and build a comprehensive match history that tells your story.',
    icon: 'activity',
    gradient: ['rgba(96, 165, 250, 0.4)', 'rgba(34, 197, 94, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'radio',
        title: 'Live Point-by-Point Scoring',
        description: 'Real-time scoring with automatic set and game aggregation. Works offline and syncs seamlessly',
      },
      {
        icon: 'bar-chart-2',
        title: 'Advanced Analytics',
        description: 'First serve percentage, winners vs unforced errors, break point conversion, and much more',
      },
      {
        icon: 'file-text',
        title: 'Match Notes & Insights',
        description: 'Take detailed notes during or after matches. Perfect for coaches and players to track improvements',
      },
      {
        icon: 'share-2',
        title: 'Shareable Reports',
        description: 'Generate beautiful reports and share with coaches, recruiters, or on social media',
      },
      {
        icon: 'filter',
        title: 'Historical Comparisons',
        description: 'Filter by opponent, surface, or date range. See trends and patterns over time',
      },
    ],
  },
  {
    title: 'Team Hub',
    subtitle: 'Stay Connected',
    description: 'Manage your team, coordinate events, and communicate effortlessly. Everything you need to keep your team organized and engaged.',
    icon: 'users',
    gradient: ['rgba(168, 85, 247, 0.4)', 'rgba(96, 165, 250, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'user',
        title: 'Team Roster & Profiles',
        description: 'Complete player profiles with photos, positions, contact info, and playing history',
      },
      {
        icon: 'shield',
        title: 'Roles & Permissions',
        description: 'Admin, Coach, and Player roles with appropriate access levels and capabilities',
      },
      {
        icon: 'message-circle',
        title: 'Group Chat & Messaging',
        description: 'Team-wide channels and direct messaging with @mentions and emoji reactions',
      },
      {
        icon: 'calendar',
        title: 'Event Coordination',
        description: 'Schedule practices, matches, and team events with RSVP tracking',
      },
      {
        icon: 'award',
        title: 'Team Statistics',
        description: 'Team-wide leaderboards, win-loss records, and performance metrics',
      },
    ],
  },
  {
    title: 'Calendar & Events',
    subtitle: 'Never Miss a Match',
    description: 'Master calendar view with color-coded events, RSVP tracking, and seamless calendar sync. Keep your schedule organized and accessible.',
    icon: 'calendar',
    gradient: ['rgba(251, 146, 60, 0.4)', 'rgba(168, 85, 247, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'layers',
        title: 'Color-Coded Calendar',
        description: 'Visual layers for matches, practices, tournaments, and personal events',
      },
      {
        icon: 'check-square',
        title: 'RSVP & Availability',
        description: 'See who\'s attending, who\'s maybe, and who can\'t make it. Track team availability at a glance',
      },
      {
        icon: 'refresh-cw',
        title: 'Calendar Sync',
        description: 'Sync with Google Calendar, Apple Calendar, and Outlook. Keep everything in one place',
      },
      {
        icon: 'bell',
        title: 'Smart Reminders',
        description: 'Automated notifications for upcoming matches, practices, and important events',
      },
      {
        icon: 'map-pin',
        title: 'Location & Details',
        description: 'Add locations, notes, and all the details your team needs to know',
      },
    ],
  },
  {
    title: 'Spectate & Watch',
    subtitle: 'Follow Live Action',
    description: 'Watch matches in real-time, follow live scorecards, listen to commentary, and catch up on highlights. Never miss a moment of the action.',
    icon: 'play-circle',
    gradient: ['rgba(239, 68, 68, 0.4)', 'rgba(251, 146, 60, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'activity',
        title: 'Live Scorecards',
        description: 'Real-time match updates with point-by-point tracking and set scores',
      },
      {
        icon: 'radio',
        title: 'Radio Commentary',
        description: 'Listen to live commentary and analysis during matches',
      },
      {
        icon: 'zap',
        title: 'Match Highlights',
        description: 'Automatically generated highlights and replay moments from key points',
      },
      {
        icon: 'bar-chart',
        title: 'Real-Time Statistics',
        description: 'Live stats updates showing current match performance and trends',
      },
      {
        icon: 'users',
        title: 'Follow Players',
        description: 'Follow your favorite players and get notified of their matches and results',
      },
    ],
  },
  {
    title: 'Analytics & Insights',
    subtitle: 'Understand Your Game',
    description: 'Deep dive into your performance with comprehensive analytics, trend analysis, and actionable insights that help you improve.',
    icon: 'trending-up',
    gradient: ['rgba(34, 197, 94, 0.4)', 'rgba(96, 165, 250, 0.3)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'pie-chart',
        title: 'Performance Breakdown',
        description: 'Detailed statistics on serves, returns, volleys, and every aspect of your game',
      },
      {
        icon: 'trending-up',
        title: 'Trend Analysis',
        description: 'Visualize your improvement over time with beautiful charts and graphs',
      },
      {
        icon: 'target',
        title: 'Strengths & Weaknesses',
        description: 'Identify what you do well and areas for improvement with data-driven insights',
      },
      {
        icon: 'users',
        title: 'Opponent Analysis',
        description: 'Compare your performance against different opponents and playing styles',
      },
      {
        icon: 'award',
        title: 'Achievements & Milestones',
        description: 'Track your progress with achievements, streaks, and personal bests',
      },
    ],
  },
  {
    title: "You're All Set!",
    subtitle: 'Ready to Elevate Your Game',
    description: 'You now have everything you need to take your game to the next level. Start tracking matches, connect with your team, and unlock your potential.',
    icon: 'check-circle',
    gradient: ['rgba(34, 197, 94, 0.5)', 'rgba(16, 185, 129, 0.4)', 'rgba(2, 6, 23, 0.95)'],
    features: [
      {
        icon: 'plus-circle',
        title: 'Log Your First Match',
        description: 'Start tracking your performance right away with our intuitive match logging',
      },
      {
        icon: 'users',
        title: 'Join or Create a Team',
        description: 'Connect with teammates and start collaborating on your journey',
      },
      {
        icon: 'bar-chart-2',
        title: 'Explore Your Stats',
        description: 'Dive into your analytics and discover insights about your game',
      },
      {
        icon: 'calendar',
        title: 'Schedule Your Events',
        description: 'Add matches and practices to your calendar and never miss a game',
      },
    ],
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const translateX = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const lastClickTime = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScroll = useRef(false);

  useEffect(() => {
    iconScale.value = withSequence(
      withTiming(1.05, { duration: 500, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) })
    );
    if (currentPage !== 0) {
      iconRotation.value = withSpring(360, { damping: 20, stiffness: 80 });
    } else {
      iconRotation.value = 0;
    }
  }, [currentPage]);

  const handleSkip = async () => {
    hapticMedium();
    try {
      await markOnboardingComplete();
      router.replace('/choose-username');
    } catch (error) {
      console.error('Failed to save onboarding completion:', error);
      router.replace('/choose-username');
    }
  };

  const handleNext = () => {
    if (currentPage >= PAGES.length - 1) return;
    
    const now = Date.now();
    if (now - lastClickTime.current < 100) return;
    lastClickTime.current = now;
    
    hapticLight();
    const nextPage = currentPage + 1;
    isProgrammaticScroll.current = true;
    setCurrentPage(nextPage);
    scrollViewRef.current?.scrollTo({
      x: nextPage * SCREEN_WIDTH,
      animated: true,
    });
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 500);
  };

  const handlePrevious = () => {
    if (currentPage <= 0) return;
    
    const now = Date.now();
    if (now - lastClickTime.current < 100) return;
    lastClickTime.current = now;
    
    hapticLight();
    const prevPage = currentPage - 1;
    isProgrammaticScroll.current = true;
    setCurrentPage(prevPage);
    scrollViewRef.current?.scrollTo({
      x: prevPage * SCREEN_WIDTH,
      animated: true,
    });
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 500);
  };

  const handleDone = async () => {
    hapticMedium();
    try {
      await markOnboardingComplete();
      router.replace('/choose-username');
    } catch (error) {
      console.error('Failed to save onboarding completion:', error);
      router.replace('/choose-username');
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    translateX.value = offsetX;
    
    if (isProgrammaticScroll.current) {
      return;
    }
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    const page = Math.round(offsetX / SCREEN_WIDTH);
    const pageOffset = Math.abs(offsetX - (page * SCREEN_WIDTH));
    
    if (pageOffset < SCREEN_WIDTH * 0.01 && page !== currentPage && page >= 0 && page < PAGES.length) {
      setCurrentPage(page);
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page >= 0 && page < PAGES.length && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  const renderPage = (page: OnboardingPage, index: number) => {
    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ];
      const opacity = interpolate(
        translateX.value,
        inputRange,
        [0.1, 1, 0.1],
        Extrapolation.CLAMP
      );
      const scale = interpolate(
        translateX.value,
        inputRange,
        [0.9, 1, 0.9],
        Extrapolation.CLAMP
      );
      const translateY = interpolate(
        translateX.value,
        inputRange,
        [20, 0, 20],
        Extrapolation.CLAMP
      );
      return {
        opacity,
        transform: [{ scale }, { translateY }],
      };
    });

    const iconAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { scale: iconScale.value },
          { rotate: `${iconRotation.value}deg` },
        ],
      };
    });

    return (
      <Animated.View
        key={index}
        style={[
          styles.pageContainer,
          { width: SCREEN_WIDTH },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={page.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { 
              paddingTop: insets.top + 20, 
              paddingBottom: insets.bottom + 280,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
            {index === 0 ? (
              <View style={styles.logoContainer}>
                <View style={styles.logoInnerCircle}>
                  <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logo}
                    resizeMode="cover"
                  />
                </View>
              </View>
            ) : (
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
              >
                <Feather name={page.icon} size={72} color="#ffffff" />
              </LinearGradient>
            )}
          </Animated.View>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.subtitle}>{page.subtitle}</Text>
          </View>

          <Text style={styles.description}>{page.description}</Text>

          <View style={styles.featuresContainer}>
            {page.features.map((feature, featureIndex) => (
              <Animated.View
                key={featureIndex}
                style={styles.featureCard}
              >
                <View style={styles.featureHeader}>
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.featureIconContainer}
                  >
                    <Feather name={feature.icon} size={24} color="#ffffff" />
                  </LinearGradient>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                </View>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        decelerationRate={0.95}
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        bounces={false}
        overScrollMode="never"
      >
        {PAGES.map((page, index) => renderPage(page, index))}
      </Animated.ScrollView>

      <View 
        style={[
          styles.skipButtonContainer, 
          { 
            top: insets.top + 12,
          }
        ]}
      >
        <GlassView 
          style={styles.skipButtonGlass} 
          isInteractive
          tintColor="rgba(255, 255, 255, 0.08)"
        >
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={styles.skipButtonTouchable}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </GlassView>
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(2, 6, 23, 0.95)', 'rgba(2, 6, 23, 1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.navigationContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.indicators}>
          {PAGES.map((_, index) => (
            <IndicatorDot
              key={index}
              index={index}
              currentPage={currentPage}
              translateX={translateX}
              screenWidth={SCREEN_WIDTH}
            />
          ))}
        </View>

        <View style={styles.buttonContainer}>
          {currentPage > 0 && (
            <GlassView 
              style={styles.backButtonGlass} 
              isInteractive
              tintColor="rgba(255, 255, 255, 0.08)"
            >
              <TouchableOpacity
                onPress={handlePrevious}
                activeOpacity={0.7}
                style={styles.backButtonTouchable}
              >
                <Feather name="chevron-left" size={22} color="#ffffff" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            </GlassView>
          )}

          <View style={{ flex: 1 }} />

          {currentPage < PAGES.length - 1 ? (
            <GlassView 
              style={styles.nextButtonGlass} 
              isInteractive
              tintColor="rgba(255, 255, 255, 0.08)"
            >
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.8}
                style={styles.nextButtonTouchable}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Feather name="chevron-right" size={18} color="#ffffff" />
              </TouchableOpacity>
            </GlassView>
          ) : (
            <GlassView 
              style={styles.doneButtonGlass} 
              isInteractive
              tintColor="rgba(255, 255, 255, 0.08)"
            >
              <TouchableOpacity
                onPress={handleDone}
                activeOpacity={0.8}
                style={styles.doneButtonTouchable}
              >
                <Text style={styles.doneButtonText}>Get Started</Text>
                <Feather name="arrow-right" size={20} color="#ffffff" />
              </TouchableOpacity>
            </GlassView>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  skipButtonContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  skipButtonGlass: {
    borderRadius: 20,
  },
  skipButtonTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  logoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  logoInnerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
    paddingBottom: 200,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  featureTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  featureDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  indicatorActive: {
    backgroundColor: '#22c55e',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buttonWrapper: {
    position: 'relative',
    minWidth: 140,
    height: 52,
  },
  backButtonGlass: {
    borderRadius: 14,
  },
  backButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonGlass: {
    borderRadius: 14,
  },
  nextButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 36,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  doneButtonGlass: {
    borderRadius: 14,
  },
  doneButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 44,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export { hasCompletedOnboarding, markOnboardingComplete } from '../api/user';
