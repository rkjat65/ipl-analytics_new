import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import 'player_profile_screen.dart';

class PlayersScreen extends StatefulWidget {
  const PlayersScreen({super.key});

  @override
  State<PlayersScreen> createState() => _PlayersScreenState();
}

class _PlayersScreenState extends State<PlayersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _search = TextEditingController();
  List<String> _seasons = [];
  String? _season;
  List<Map<String, dynamic>> _batters = [];
  List<Map<String, dynamic>> _bowlers = [];
  List<String> _searchResults = [];
  bool _loading = true;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
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
        api.getBattingLeaderboard(season: _season, limit: 40),
        api.getBowlingLeaderboard(season: _season, limit: 40),
      ]);
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _batters = results[0];
        _bowlers = results[1];
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

  void _onSearch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () async {
      if (q.trim().length < 2) {
        setState(() => _searchResults = []);
        return;
      }
      try {
        final res = await context.read<ApiService>().searchPlayers(q.trim());
        if (!mounted) return;
        setState(() => _searchResults = res);
      } catch (_) {}
    });
  }

  void _openPlayer(String name) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PlayerProfileScreen(playerName: name)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Players'),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: CrickTheme.cyan,
          labelColor: CrickTheme.cyan,
          unselectedLabelColor: CrickTheme.textMuted,
          tabs: const [
            Tab(text: 'Batting'),
            Tab(text: 'Bowling'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SearchField(
              controller: _search,
              hint: 'Search players…',
              onChanged: _onSearch,
            ),
          ),
          if (_searchResults.isNotEmpty)
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _searchResults.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final name = _searchResults[i];
                  return ActionChip(
                    avatar: PlayerAvatar(name: name, size: 22),
                    label: Text(name),
                    onPressed: () => _openPlayer(name),
                  );
                },
              ),
            ),
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
                : TabBarView(
                    controller: _tabs,
                    children: [
                      _list(
                        _batters,
                        primary: (p) => formatNumber(p['runs']),
                        label: 'runs',
                        secondary: (p) =>
                            'Avg ${formatDecimal(p['avg'])} · SR ${formatDecimal(p['sr'])}',
                      ),
                      _list(
                        _bowlers,
                        primary: (p) => formatNumber(p['wickets']),
                        label: 'wkts',
                        secondary: (p) =>
                            'Econ ${formatDecimal(p['economy'])} · Avg ${formatDecimal(p['avg'])}',
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _list(
    List<Map<String, dynamic>> rows, {
    required String Function(Map<String, dynamic>) primary,
    required String label,
    required String Function(Map<String, dynamic>) secondary,
  }) {
    return RefreshIndicator(
      color: CrickTheme.cyan,
      onRefresh: _load,
      child: ListView.builder(
        itemCount: rows.length,
        itemBuilder: (_, i) {
          final p = rows[i];
          final name = p['player']?.toString() ?? '';
          return LeaderboardTile(
            rank: i + 1,
            name: name,
            primary: primary(p),
            primaryLabel: label,
            secondary: secondary(p),
            onTap: () => _openPlayer(name),
          );
        },
      ),
    );
  }
}
