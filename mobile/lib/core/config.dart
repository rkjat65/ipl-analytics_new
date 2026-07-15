class AppConfig {
  /// Production API base (no trailing slash).
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://crickrida.rkjat.in',
  );

  static String get apiPrefix => '$apiBase/api';

  static String playerImage(String name) =>
      '$apiPrefix/players/${Uri.encodeComponent(name)}/image';

  static String teamImage(String filename) =>
      '$apiPrefix/team-images/$filename';

  static String venueImage(String name) =>
      '$apiPrefix/venues/${Uri.encodeComponent(name)}/image';
}
