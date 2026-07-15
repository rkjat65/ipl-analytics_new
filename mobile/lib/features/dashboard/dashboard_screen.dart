import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/teams.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import '../matches/match_detail_screen.dart';
import '../players/player_profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<String> _seasons = [];
  String? _season;
  Map<String, dynamic>? _kpis;
  List<Map<String, dynamic>> _batters = [];
  List<Map<String, dynamic>> _bowlers = [];
  List<Map<String, dynamic>> _matches = [];
  List<Map<String, dynamic>> _mostWins = [];
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
        api.getKpis(season: _season),
        api.getBattingLeaderboard(season: _season, limit: 8),
        api.getBowlingLeaderboard(season: _season, limit: 8),
        api.getMatches(season: _season, limit: 8),
        api.getMostWins(season: _season),
      ]);
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _kpis = results[0] as Map<String, dynamic>;
        _batters = results[1] as List<Map<String, dynamic>>;
        _bowlers = results[2] as List<Map<String, dynamic>>;
        _matches = asMapList(results[3], 'matches');
        _mostWins = results[4] as List<Map<String, dynamic>>;
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
      appBar: AppBar(
        title: const Text('Crickrida'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: _error != null && _kpis == null
          ? ErrorView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              color: CrickTheme.cyan,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
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
                  if (_loading && _kpis == null)
                    const Padding(padding: EdgeInsets.all(40), child: LoadingView())
                  else ...[
                    const SectionHeader('Season pulse'),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        // Dense tiles — no huge empty vertical space
                        childAspectRatio: 2.05,
                        children: [
                          StatCard(
                            label: 'Matches',
                            value: formatNumber(_kpis?['total_matches']),
                            color: CrickTheme.cyan,
                          ),
                          StatCard(
                            label: 'Runs',
                            value: formatNumber(_kpis?['total_runs']),
                            color: CrickTheme.lime,
                          ),
                          StatCard(
                            label: 'Wickets',
                            value: formatNumber(_kpis?['total_wickets']),
                            color: CrickTheme.magenta,
                          ),
                          StatCard(
                            label: 'Sixes',
                            value: formatNumber(_kpis?['total_sixes']),
                            color: CrickTheme.amber,
                            subtitle: _kpis?['most_sixes_player'] is Map
                                ? '${(_kpis!['most_sixes_player'] as Map)['player']}'
                                : null,
                          ),
                          StatCard(
                            label: 'Avg score',
                            value: formatDecimal(_kpis?['avg_score']),
                            color: CrickTheme.purple,
                          ),
                          StatCard(
                            label: 'Highest',
                            value: _kpis?['highest_total'] is Map
                                ? formatNumber((_kpis!['highest_total'] as Map)['total_runs'])
                                : '—',
                            color: CrickTheme.cyan,
                            subtitle: _kpis?['highest_total'] is Map
                                ? teamAbbr((_kpis!['highest_total'] as Map)['batting_team']?.toString())
                                : null,
                          ),
                        ],
                      ),
                    ),
                    const SectionHeader('Top batters'),
                    ..._batters.asMap().entries.map((e) {
                      final p = e.value;
                      final name = p['player']?.toString() ?? '';
                      return LeaderboardTile(
                        rank: e.key + 1,
                        name: name,
                        primary: formatNumber(p['runs']),
                        primaryLabel: 'runs',
                        secondary: 'Avg ${formatDecimal(p['avg'])} · SR ${formatDecimal(p['sr'])}',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => PlayerProfileScreen(playerName: name)),
                        ),
                      );
                    }),
                    const SectionHeader('Top bowlers'),
                    ..._bowlers.asMap().entries.map((e) {
                      final p = e.value;
                      final name = p['player']?.toString() ?? '';
                      return LeaderboardTile(
                        rank: e.key + 1,
                        name: name,
                        primary: formatNumber(p['wickets']),
                        primaryLabel: 'wkts',
                        secondary: 'Econ ${formatDecimal(p['economy'])} · Avg ${formatDecimal(p['avg'])}',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => PlayerProfileScreen(playerName: name)),
                        ),
                      );
                    }),
                    if (_mostWins.isNotEmpty) ...[
                      const SectionHeader('Most wins'),
                      ..._mostWins.take(6).map((t) {
                        final team = t['team']?.toString() ?? t['winner']?.toString() ?? '';
                        return CrickCard(
                          child: Row(
                            children: [
                              TeamLogo(team: team),
                              const SizedBox(width: 12),
                              Expanded(child: Text(team, style: const TextStyle(fontWeight: FontWeight.w600))),
                              Text(
                                formatNumber(t['wins'] ?? t['count']),
                                style: CrickTheme.mono.copyWith(color: CrickTheme.lime, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                    const SectionHeader('Recent matches'),
                    ..._matches.map(
                      (m) => MatchTile(
                        match: m,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => MatchDetailScreen(matchId: m['match_id'].toString()),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ],
              ),
            ),
    );
  }
}
