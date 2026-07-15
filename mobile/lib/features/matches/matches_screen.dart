import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import 'match_detail_screen.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});

  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  List<String> _seasons = [];
  List<String> _teams = [];
  String? _season;
  String? _team;
  List<Map<String, dynamic>> _matches = [];
  int _total = 0;
  int _offset = 0;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  final _limit = 25;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final api = context.read<ApiService>();
    try {
      final seasons = await api.getSeasons();
      final teams = await api.getTeams();
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _teams = teams;
      });
      await _load(reset: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _offset = 0;
        _loading = true;
        _error = null;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    final api = context.read<ApiService>();
    try {
      final data = await api.getMatches(
        season: _season,
        team: _team,
        limit: _limit,
        offset: reset ? 0 : _offset,
      );
      final list = asMapList(data, 'matches');
      if (!mounted) return;
      setState(() {
        if (reset) {
          _matches = list;
          _offset = list.length;
        } else {
          _matches = [..._matches, ...list];
          _offset += list.length;
        }
        _total = (data['total'] as num?)?.toInt() ?? _matches.length;
        _loading = false;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Matches')),
      body: Column(
        children: [
          const SizedBox(height: 8),
          SeasonChipBar(
            seasons: _seasons,
            selected: _season,
            onChanged: (s) {
              setState(() => _season = s);
              _load(reset: true);
            },
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('All teams'),
                    selected: _team == null,
                    onSelected: (_) {
                      setState(() => _team = null);
                      _load(reset: true);
                    },
                  ),
                ),
                ..._teams.map(
                  (t) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(teamAbbrSafe(t)),
                      selected: _team == t,
                      onSelected: (_) {
                        setState(() => _team = t);
                        _load(reset: true);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                _loading ? 'Loading…' : '$_total matches',
                style: const TextStyle(
                  color: CrickTheme.textMuted,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          Expanded(
            child: _loading && _matches.isEmpty
                ? const LoadingView()
                : _error != null && _matches.isEmpty
                ? ErrorView(message: _error!, onRetry: () => _load(reset: true))
                : RefreshIndicator(
                    color: CrickTheme.cyan,
                    onRefresh: () => _load(reset: true),
                    child: ListView.builder(
                      itemCount: _matches.length + 1,
                      itemBuilder: (context, i) {
                        if (i == _matches.length) {
                          if (_matches.length >= _total) {
                            return const SizedBox(height: 40);
                          }
                          return Padding(
                            padding: const EdgeInsets.all(16),
                            child: Center(
                              child: _loadingMore
                                  ? const CircularProgressIndicator(
                                      color: CrickTheme.cyan,
                                    )
                                  : OutlinedButton(
                                      onPressed: () => _load(),
                                      child: const Text('Load more'),
                                    ),
                            ),
                          );
                        }
                        final m = _matches[i];
                        return MatchTile(
                          match: m,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => MatchDetailScreen(
                                matchId: m['match_id'].toString(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

String teamAbbrSafe(String t) {
  if (t.length <= 12) return t;
  final parts = t.split(' ');
  if (parts.length >= 2) {
    return parts.map((e) => e.isNotEmpty ? e[0] : '').join();
  }
  return t.substring(0, 10);
}
