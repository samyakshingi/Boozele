import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#131313', // Level 0 background per DESIGN.md
          borderBottomWidth: 1,
          borderBottomColor: '#201f1f',
        },
        headerTitleStyle: {
          fontFamily: 'Inter',
          fontWeight: '700',
          fontSize: 18,
          color: '#e5e2e1', // on-surface text
        },
        tabBarStyle: {
          backgroundColor: '#131313',
          borderTopWidth: 1,
          borderTopColor: '#201f1f',
          height: 64, // 64px tab height per DESIGN.md
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#ff5167', // Primary Pink per DESIGN.md
        tabBarInactiveTintColor: '#e6bcbd', // Secondary Muted Grey
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Swipe',
          tabBarLabel: 'Swipe',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buddies"
        options={{
          title: 'Buddies',
          tabBarLabel: 'Buddies',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="parties"
        options={{
          title: 'Parties',
          tabBarLabel: 'Parties',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'beer' : 'beer-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
