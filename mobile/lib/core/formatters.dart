import 'package:intl/intl.dart';

String formatNumber(dynamic n) {
  if (n == null) return '—';
  final num? v = n is num ? n : num.tryParse(n.toString());
  if (v == null) return n.toString();
  return NumberFormat.decimalPattern('en_IN').format(v.round());
}

String formatDecimal(dynamic n, [int digits = 2]) {
  if (n == null) return '—';
  final num? v = n is num ? n : num.tryParse(n.toString());
  if (v == null) return n.toString();
  return v.toStringAsFixed(digits);
}

String formatDate(dynamic raw) {
  if (raw == null) return '—';
  try {
    final d = DateTime.parse(raw.toString());
    return DateFormat('d MMM yyyy').format(d);
  } catch (_) {
    return raw.toString();
  }
}

String matchResult(Map<String, dynamic> m) {
  final winner = m['winner']?.toString();
  if (winner == null || winner.isEmpty) {
    final result = m['result']?.toString() ?? '—';
    return result;
  }
  final byRuns = m['win_by_runs'];
  final byWkts = m['win_by_wickets'];
  if (byRuns != null && byRuns != 0) {
    return '$winner won by $byRuns runs';
  }
  if (byWkts != null && byWkts != 0) {
    return '$winner won by $byWkts wkts';
  }
  return '$winner won';
}

T? asMapValue<T>(dynamic map, String key) {
  if (map is! Map) return null;
  final v = map[key];
  if (v is T) return v;
  return null;
}

List<Map<String, dynamic>> asMapList(dynamic data, [String? key]) {
  dynamic list = data;
  if (key != null && data is Map) list = data[key];
  if (list is! List) return [];
  return list
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

Map<String, dynamic> asStringKeyedMap(dynamic data) {
  if (data is Map<String, dynamic>) return data;
  if (data is Map) return Map<String, dynamic>.from(data);
  return {};
}
