import 'package:flutter/material.dart';

class DeltColors {
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const surface = Color(0xFFF8FAFC);
  static const panel = Color(0xFFF1F5F9);
  static const accent = Color(0xFF6366F1);
  static const success = Color(0xFF10B981);
}

ThemeData deltTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: DeltColors.accent,
      primary: DeltColors.text,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: Colors.white,
    fontFamily: 'SF Pro Display',
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: DeltColors.text,
      displayColor: DeltColors.text,
    ),
    dividerColor: DeltColors.border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DeltColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DeltColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DeltColors.accent, width: 1.5),
      ),
    ),
  );
}
