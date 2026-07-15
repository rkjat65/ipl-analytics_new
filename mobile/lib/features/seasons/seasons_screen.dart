import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class SeasonsScreen extends StatefulWidget {
  const SeasonsScreen({super.key});

  @override
  State<SeasonsScreen> createState() => _SeasonsScreenState();
}

class _SeasonsScreenState extends State<SeasonsScreen> {
  List<String> _seasons = [];
  String? _selected;
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _table = [];
  Map<String, dynamic>? _capRace;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final seasons = await context.read<ApiService>().getSeasons();
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _selected = seasons.isNotEmpty ? seasons.last : null;
      });
      await _loadSeason();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadSeason() async {
    if (_selected == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<ApiService>();
    try {
      final summary = await api.getSeasonSummary(_selected!);
      List<Map<String, dynamic>> table = [];
      Map<String, dynamic> cap = {};
      try {
        table = await api.getPointsTable(_selected!);
      } catch (_) {}
      try {
        cap = await api.getCapRace(_selected!);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _table = table;
        _capRace = cap;
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
    final orangeCap = asMapList(_capRace, 'orange').isNotEmpty
        ? asMapList(_capRace, 'orange')
        : asMapList(_capRace, 'orange_cap');
    final purpleCap = asMapList(_capRace, 'purple').isNotEmpty
        ? asMapList(_capRace, 'purple')
        : asMapList(_capRace, 'purple_cap');

    return Scaffold(
      appBar: AppBar(title: const Text('Seasons')),
      body: Column(
        children: [
          const SizedBox(height: 8),
          SeasonChipBar(
            seasons: _seasons,
            selected: _selected,
            includeAll: false,
            onChanged: (s) {
              if (s == null) return;
              setState(() => _selected = s);
              _loadSeason();
            },
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorView(message: _error!, onRetry: _loadSeason)
                : RefreshIndicator(
                    color: CrickTheme.cyan,
                    onRefresh: _loadSeason,
                    child: ListView(
                      children: [
                        if (_summary != null) ...[
                          const SectionHeader('Summary'),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 10,
                              crossAxisSpacing: 10,
                              childAspectRatio: 1.5,
                              children: [
                                StatCard(
                                  label: 'Matches',
                                  value: formatNumber(
                                    _summary!['matches'] ??
                                        _summary!['total_matches'],
                                  ),
                                ),
                                StatCard(
                                  label: 'Runs',
                                  value: formatNumber(
                                    _summary!['total_runs'] ??
                                        _summary!['runs'],
                                  ),
                                  color: CrickTheme.lime,
                                ),
                                StatCard(
                                  label: 'Sixes',
                                  value: formatNumber(
                                    _summary!['sixes'] ??
                                        _summary!['total_sixes'],
                                  ),
                                  color: CrickTheme.amber,
                                ),
                                StatCard(
                                  label: 'Winner',
                                  value:
                                      (_summary!['winner'] ??
                                              _summary!['champion'] ??
                                              '—')
                                          .toString(),
                                  color: CrickTheme.magenta,
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_table.isNotEmpty) ...[
                          const SectionHeader('Points table'),
                          ..._table.asMap().entries.map((e) {
                            final r = e.value;
                            final team = (r['team'] ?? r['name'] ?? '')
                                .toString();
                            return CrickCard(
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 28,
                                    child: Text(
                                      '${e.key + 1}',
                                      style: GoogleFonts.jetBrainsMono(
                                        color: e.key < 4
                                            ? CrickTheme.lime
                                            : CrickTheme.textMuted,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  TeamLogo(team: team, size: 30),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      team,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    'P ${formatNumber(r['played'] ?? r['matches'])}  '
                                    'W ${formatNumber(r['wins'] ?? r['won'])}  '
                                    'Pts ${formatNumber(r['points'] ?? r['pts'])}',
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 11,
                                      color: CrickTheme.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                        if (orangeCap.isNotEmpty) ...[
                          const SectionHeader('Orange cap'),
                          ...orangeCap.take(5).map((p) {
                            final name = (p['player'] ?? '').toString();
                            return LeaderboardTile(
                              rank: orangeCap.indexOf(p) + 1,
                              name: name,
                              primary: formatNumber(p['runs']),
                              primaryLabel: 'runs',
                            );
                          }),
                        ],
                        if (purpleCap.isNotEmpty) ...[
                          const SectionHeader('Purple cap'),
                          ...purpleCap.take(5).map((p) {
                            final name = (p['player'] ?? '').toString();
                            return LeaderboardTile(
                              rank: purpleCap.indexOf(p) + 1,
                              name: name,
                              primary: formatNumber(p['wickets']),
                              primaryLabel: 'wkts',
                            );
                          }),
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
}
