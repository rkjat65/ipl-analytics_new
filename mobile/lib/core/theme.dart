import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class CrickTheme {
  static const bgPrimary = Color(0xFF0A0A0F);
  static const bgCard = Color(0xFF111118);
  static const bgCardHover = Color(0xFF1A1A24);
  static const bgElevated = Color(0xFF16161F);
  static const borderSubtle = Color(0xFF1E1E2A);
  static const borderActive = Color(0xFF2A2A3A);
  static const textPrimary = Color(0xFFE8E8ED);
  static const textSecondary = Color(0xFF8888A0);
  static const textMuted = Color(0xFF555566);
  static const cyan = Color(0xFF00E5FF);
  static const magenta = Color(0xFFFF2D78);
  static const lime = Color(0xFFB8FF00);
  static const amber = Color(0xFFFFB800);
  static const purple = Color(0xFF8B5CF6);
  static const success = Color(0xFF22C55E);
  static const danger = Color(0xFFEF4444);

  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgPrimary,
      colorScheme: const ColorScheme.dark(
        surface: bgPrimary,
        primary: cyan,
        secondary: magenta,
        tertiary: lime,
        error: danger,
        onPrimary: bgPrimary,
        onSecondary: textPrimary,
        onSurface: textPrimary,
      ),
      dividerColor: borderSubtle,
      cardColor: bgCard,
      appBarTheme: AppBarTheme(
        backgroundColor: bgPrimary,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.spaceGrotesk(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: bgElevated,
        selectedItemColor: cyan,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgCard,
        hintStyle: const TextStyle(color: textMuted),
        labelStyle: const TextStyle(color: textSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: cyan, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: bgCard,
        selectedColor: cyan.withValues(alpha: 0.2),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 12),
        side: const BorderSide(color: borderSubtle),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: bgElevated,
        contentTextStyle: const TextStyle(color: textPrimary),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: bgElevated,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: cyan,
        foregroundColor: bgPrimary,
      ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(
        base.textTheme,
      ).apply(bodyColor: textPrimary, displayColor: textPrimary),
      primaryTextTheme: GoogleFonts.spaceGroteskTextTheme(
        base.primaryTextTheme,
      ),
    );
  }

  static TextStyle get mono => GoogleFonts.jetBrainsMono(color: textPrimary);
  static TextStyle get heading =>
      GoogleFonts.spaceGrotesk(color: textPrimary, fontWeight: FontWeight.w700);
}
