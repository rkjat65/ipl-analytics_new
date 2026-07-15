import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class ChartsScreen extends StatefulWidget {
  const ChartsScreen({super.key});

  @override
  State<ChartsScreen> createState() => _ChartsScreenState();
}

class _ChartsScreenState extends State<ChartsScreen> {
  List<String> _seasons = [];
  String? _season;
  List<Map<String, dynamic>> _topSixes = [];
  List<Map<String, dynamic>> _topFours = [];
  List<Map<String, dynamic>> _mostWins = [];
  List<Map<String, dynamic>> _topTotals = [];
  dynamic _phase;
  dynamic _dismissals;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<ApiService>();
    try {
      final seasons = await api.getSeasons();
      final results = await Future.wait([
        api.getTopSixes(season: _season),
        api.getTopFours(season: _season),
        api.getMostWins(season: _season),
        api.getTopTotals(season: _season),
        api.getPhaseStats(season: _season),
        api.getDismissalTypes(season: _season),
      ]);
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _topSixes = results[0] as List<Map<String, dynamic>>;
        _topFours = results[1] as List<Map<String, dynamic>>;
        _mostWins = results[2] as List<Map<String, dynamic>>;
        _topTotals = results[3] as List<Map<String, dynamic>>;
        _phase = results[4];
        _dismissals = results[5];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Charts')),
      body: Column(
        children: [
          const SizedBox(height: 8),
          SeasonChipBar(
            seasons: _seasons,
            selected: _season,
            onChanged: (s) {
              setState(() => _season = s);
              _load();
            },
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                    ? ErrorView(message: _error!, onRetry: _load)
                    : RefreshIndicator(
                        color: CrickTheme.cyan,
                        onRefresh: _load,
                        child: ListView(
                          children: [
                            const SectionHeader('Most sixes'),
                            _barChart(
                              _topSixes.take(8).toList(),
                              labelOf: (m) => (m['player'] ?? m['team'] ?? '').toString(),
                              valueOf: (m) => (m['sixes'] ?? m['count'] ?? 0) as num,
                              color: CrickTheme.amber,
                            ),
                            const SectionHeader('Most fours'),
                            _barChart(
                              _topFours.take(8).toList(),
                              labelOf: (m) => (m['player'] ?? m['team'] ?? '').toString(),
                              valueOf: (m) => (m['fours'] ?? m['count'] ?? 0) as num,
                              color: CrickTheme.cyan,
                            ),
                            const SectionHeader('Most wins'),
                            _barChart(
                              _mostWins.take(8).toList(),
                              labelOf: (m) => (m['team'] ?? m['winner'] ?? '').toString(),
                              valueOf: (m) => (m['wins'] ?? m['count'] ?? 0) as num,
                              color: CrickTheme.lime,
                            ),
                            if (_topTotals.isNotEmpty) ...[
                              const SectionHeader('Highest totals'),
                              ..._topTotals.take(8).map((t) {
                                return CrickCard(
                                  child: Row(
                                    children: [
                                      TeamLogo(team: (t['team'] ?? t['batting_team'] ?? '').toString(), size: 28),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          (t['team'] ?? t['batting_team'] ?? '').toString(),
                                          style: const TextStyle(fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                      Text(
                                        formatNumber(t['total_runs'] ?? t['runs'] ?? t['score']),
                                        style: GoogleFonts.jetBrainsMono(color: CrickTheme.magenta, fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],
                            if (_phase != null) ...[
                              const SectionHeader('Phase stats'),
                              CrickCard(child: Text(_prettyJsonish(_phase), style: const TextStyle(fontSize: 12, color: CrickTheme.textSecondary))),
                            ],
                            if (_dismissals != null) ...[
                              const SectionHeader('Dismissals'),
                              CrickCard(child: Text(_prettyJsonish(_dismissals), style: const TextStyle(fontSize: 12, color: CrickTheme.textSecondary))),
                            ],
                            const SizedBox(height: 24),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _barChart(
    List<Map<String, dynamic>> rows, {
    required String Function(Map<String, dynamic>) labelOf,
    required num Function(Map<String, dynamic>) valueOf,
    required Color color,
  }) {
    if (rows.isEmpty) return const EmptyView(message: 'No chart data');
    final maxY = rows.map(valueOf).fold<num>(0, (a, b) => a > b ? a : b).toDouble();
    return CrickCard(
      child: SizedBox(
        height: 220,
        child: BarChart(
          BarChartData(
            maxY: maxY * 1.2,
            gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => const FlLine(color: CrickTheme.borderSubtle, strokeWidth: 1)),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (v, _) => Text(v.toInt().toString(), style: const TextStyle(color: CrickTheme.textMuted, fontSize: 10)),
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  getTitlesWidget: (v, meta) {
                    final i = v.toInt();
                    if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                    final label = labelOf(rows[i]);
                    final short = label.length > 8 ? label.substring(0, 8) : label;
                    return Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(short, style: const TextStyle(color: CrickTheme.textMuted, fontSize: 9)),
                    );
                  },
                ),
              ),
            ),
            barGroups: [
              for (var i = 0; i < rows.length; i++)
                BarChartGroupData(
                  x: i,
                  barRods: [
                    BarChartRodData(
                      toY: valueOf(rows[i]).toDouble(),
                      color: color,
                      width: 14,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _prettyJsonish(dynamic data) {
    if (data is List) {
      return data.take(12).map((e) {
        if (e is Map) return e.entries.take(4).map((kv) => '${kv.key}: ${kv.value}').join(' · ');
        return e.toString();
      }).join('\n');
    }
    if (data is Map) {
      return data.entries.take(16).map((e) => '${e.key}: ${e.value}').join('\n');
    }
    return data.toString();
  }
}
