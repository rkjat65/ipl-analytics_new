import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class ImpactScreen extends StatefulWidget {
  const ImpactScreen({super.key});

  @override
  State<ImpactScreen> createState() => _ImpactScreenState();
}

class _ImpactScreenState extends State<ImpactScreen> {
  final _search = TextEditingController();
  List<String> _results = [];
  String? _player;
  List<String> _seasons = [];
  String? _season;
  Map<String, dynamic>? _impact;
  bool _loading = false;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    context.read<ApiService>().getSeasons().then((s) {
      if (mounted) setState(() => _seasons = s);
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () async {
      if (q.trim().length < 2) {
        setState(() => _results = []);
        return;
      }
      final res = await context.read<ApiService>().searchPlayers(q.trim());
      if (!mounted) return;
      setState(() => _results = res);
    });
  }

  Future<void> _loadImpact(String player) async {
    setState(() {
      _player = player;
      _loading = true;
      _error = null;
      _results = [];
      _search.text = player;
    });
    try {
      final data = await context.read<ApiService>().getPlayerImpact(
        player: player,
        season: _season,
      );
      if (!mounted) return;
      setState(() {
        _impact = data;
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
      appBar: AppBar(title: const Text('Player Impact')),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SearchField(
              controller: _search,
              hint: 'Search player for impact metrics…',
              onChanged: _onSearch,
            ),
          ),
          if (_results.isNotEmpty)
            ..._results
                .take(8)
                .map(
                  (p) => ListTile(
                    leading: PlayerAvatar(name: p, size: 32),
                    title: Text(p),
                    onTap: () => _loadImpact(p),
                  ),
                ),
          SeasonChipBar(
            seasons: _seasons,
            selected: _season,
            onChanged: (s) {
              setState(() => _season = s);
              if (_player != null) _loadImpact(_player!);
            },
          ),
          if (_loading)
            const Padding(padding: EdgeInsets.all(32), child: LoadingView()),
          if (_error != null)
            ErrorView(
              message: _error!,
              onRetry: _player == null ? null : () => _loadImpact(_player!),
            ),
          if (!_loading && _impact != null) ...[
            CrickCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      PlayerAvatar(name: _player ?? '', size: 48),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _player ?? '',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ..._impact!.entries.take(20).map((e) {
                    if (e.value is Map || e.value is List) {
                      return const SizedBox.shrink();
                    }
                    return KeyValueRow(
                      e.key,
                      e.value?.toString() ?? '—',
                      accent: true,
                    );
                  }),
                ],
              ),
            ),
            ..._phaseTiles(),
            CrickCard(
              child: Text(
                'Raw metrics loaded from /advanced/player-impact',
                style: TextStyle(
                  color: CrickTheme.textMuted.withValues(alpha: 0.9),
                  fontSize: 11,
                ),
              ),
            ),
          ],
          if (!_loading && _impact == null && _player == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: EmptyView(
                message: 'Search a player to view impact metrics',
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  List<Widget> _phaseTiles() {
    final phases = asMapList(_impact, 'phases');
    final list = phases.isNotEmpty ? phases : asMapList(_impact, 'by_phase');
    if (list.isEmpty) return const [];
    return [
      const SectionHeader('By phase'),
      ...list.map(
        (p) => CrickCard(
          child: Text(
            p.entries.take(5).map((e) => '${e.key}: ${e.value}').join(' · '),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 12,
              color: CrickTheme.textSecondary,
            ),
          ),
        ),
      ),
    ];
  }
}
